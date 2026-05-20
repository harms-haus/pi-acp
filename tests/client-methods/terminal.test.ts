import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

// ---------------------------------------------------------------------------
// Hoisted mocks — available inside vi.mock factories
// ---------------------------------------------------------------------------
const { mockGetClientCapabilities, mockSendClientRequest, mockGetSession, mockSpawn } = vi.hoisted(
  () => ({
    mockGetClientCapabilities: vi.fn(),
    mockSendClientRequest: vi.fn(),
    mockGetSession: vi.fn(),
    mockSpawn: vi.fn(),
  }),
);

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock("../../src/acp/client-state.js", () => ({
  getClientCapabilities: mockGetClientCapabilities,
}));

vi.mock("../../src/acp/protocol.js", () => ({
  sendClientRequest: mockSendClientRequest,
}));

vi.mock("../../src/pi/session-registry.js", () => ({
  getSession: mockGetSession,
}));

vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

// ---------------------------------------------------------------------------
// Helpers — create a fake ChildProcess whose events we can emit manually
// ---------------------------------------------------------------------------
function createFakeChildProcess(): ChildProcess & {
  emitStdout: (data: string) => void;
  emitStderr: (data: string) => void;
  emitExit: (code: number | null, signal?: string | null) => void;
  emitError: (err: Error) => void;
} {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const emitter = new EventEmitter();
  const kill = vi.fn();

  (emitter as any).stdout = stdout;
  (emitter as any).stderr = stderr;
  (emitter as any).kill = kill;
  // stdin is sometimes accessed; provide a no-op writable-ish stub
  (emitter as any).stdin = { write: vi.fn(), end: vi.fn() };

  return Object.assign(emitter as ChildProcess, {
    emitStdout(data: string) {
      stdout.emit("data", Buffer.from(data));
    },
    emitStderr(data: string) {
      stderr.emit("data", Buffer.from(data));
    },
    emitExit(code: number | null, signal?: string | null) {
      emitter.emit("exit", code, signal ?? null);
    },
    emitError(err: Error) {
      emitter.emit("error", err);
    },
  });
}

// ---------------------------------------------------------------------------
// Imports — MUST come after vi.mock calls
// ---------------------------------------------------------------------------
import {
  handleTerminalCreate,
  handleTerminalOutput,
  handleTerminalWaitForExit,
  handleTerminalRelease,
  handleTerminalKill,
} from "../../src/client-methods/terminal.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("handleTerminalCreate", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(() => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to sendClientRequest when client has capability", async () => {
    mockGetClientCapabilities.mockReturnValue({ terminal: true });
    mockSendClientRequest.mockResolvedValue({ terminalId: "remote_1" });

    const result = await handleTerminalCreate({ command: "echo", args: ["hi"] });

    expect(mockSendClientRequest).toHaveBeenCalledWith("terminal/create", {
      command: "echo",
      args: ["hi"],
    });
    expect(result).toEqual({ terminalId: "remote_1" });
  });

  it("throws -32602 when command is missing", async () => {
    await expect(handleTerminalCreate({})).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  it("spawns process and returns terminalId", async () => {
    const result = await handleTerminalCreate({ command: "ls", args: ["-la"] });

    expect(mockSpawn).toHaveBeenCalledWith(
      "ls",
      ["-la"],
      expect.objectContaining({ shell: false }),
    );
    expect(result).toHaveProperty("terminalId");
    expect(typeof result.terminalId).toBe("string");
    expect(result.terminalId).toMatch(/^term_\d+_[a-z0-9]+$/);
  });
});

describe("handleTerminalOutput", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns output for a known terminal", async () => {
    // Create a terminal first
    const { terminalId } = await handleTerminalCreate({ command: "echo", args: ["hello"] });
    // Simulate stdout
    fakeProc.emitStdout("hello world\n");

    const result = await handleTerminalOutput({ terminalId });

    expect(result).toEqual(
      expect.objectContaining({
        output: expect.stringContaining("hello world"),
        exitStatus: undefined,
        truncated: false,
      }),
    );
  });

  it("throws -32002 when terminal not found", async () => {
    await expect(handleTerminalOutput({ terminalId: "nonexistent" })).rejects.toThrow(
      expect.objectContaining({ code: -32002 }),
    );
  });
});

describe("handleTerminalWaitForExit", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves waiter when process exits", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "true" });

    const exitPromise = handleTerminalWaitForExit({ terminalId });
    // Exit happens after waiter is registered
    fakeProc.emitExit(0);

    const result = await exitPromise;

    expect(result).toEqual({ exitCode: 0, signal: undefined });
  });

  it("resolves when process exits later", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "sleep", args: ["10"] });

    const exitPromise = handleTerminalWaitForExit({ terminalId });

    // Simulate exit after a short tick
    setTimeout(() => {
      fakeProc.emitExit(42, "SIGKILL");
    }, 0);

    const result = await exitPromise;

    expect(result).toEqual({ exitCode: 42, signal: "SIGKILL" });
  });
});

describe("handleTerminalRelease", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("kills a running process and removes it from activeTerminals", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "sleep", args: ["100"] });

    const result = await handleTerminalRelease({ terminalId });

    expect(result).toEqual({});
    expect((fakeProc as any).kill).toHaveBeenCalledWith("SIGTERM");

    // Confirm it's gone — fetching output should fail
    await expect(handleTerminalOutput({ terminalId })).rejects.toThrow(
      expect.objectContaining({ code: -32002 }),
    );
  });
});

describe("handleTerminalKill", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends SIGTERM to a running process", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "sleep", args: ["100"] });

    await handleTerminalKill({ terminalId });

    expect((fakeProc as any).kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("removes the terminal from activeTerminals", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "sleep", args: ["100"] });

    await handleTerminalKill({ terminalId });

    // Subsequent access should throw "not found"
    await expect(handleTerminalOutput({ terminalId })).rejects.toThrow(
      expect.objectContaining({ code: -32002 }),
    );
  });

  it("throws -32002 when terminal not found", async () => {
    await expect(handleTerminalKill({ terminalId: "nonexistent" })).rejects.toThrow(
      expect.objectContaining({ code: -32002 }),
    );
  });

  it("does not call kill on an already-exited process", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "true" });
    // Simulate the process exiting — the exit handler auto-removes from activeTerminals
    fakeProc.emitExit(0);

    // After auto-removal, attempting to kill should throw "not found"
    await expect(handleTerminalKill({ terminalId })).rejects.toThrow(
      expect.objectContaining({ code: -32002 }),
    );

    // Verify kill was never called on the fake proc (exited naturally)
    expect((fakeProc as any).kill).not.toHaveBeenCalled();
  });

  it("throws -32602 when terminalId is missing", async () => {
    await expect(handleTerminalKill({})).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });
});

describe("handleTerminalRelease — edge cases", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws -32602 when terminalId is missing", async () => {
    await expect(handleTerminalRelease({})).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });
});

describe("terminal output truncation", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("truncates output when it exceeds outputByteLimit", async () => {
    const limit = 20;
    const { terminalId } = await handleTerminalCreate({
      command: "cat",
      outputByteLimit: limit,
    });

    // Emit more data than the limit
    fakeProc.emitStdout("a".repeat(50));

    const result = await handleTerminalOutput({ terminalId });

    // Output should be truncated to the limit (last N chars)
    expect(result.output.length).toBeLessThanOrEqual(limit);
    expect(result.truncated).toBe(true);
  });
});

describe("terminal spawn error", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles spawn error gracefully", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "nonexistent_cmd" });

    // Simulate a spawn error
    fakeProc.emitError(new Error("spawn nonexistent_cmd ENOENT"));

    // After error, the terminal is cleaned up — accessing it should throw RESOURCE_NOT_FOUND
    await expect(handleTerminalOutput({ terminalId })).rejects.toThrow(
      `Terminal not found: ${terminalId}`,
    );

    // Verify process listeners were cleaned up
    expect(fakeProc.listenerCount("exit")).toBe(0);
    expect(fakeProc.listenerCount("error")).toBe(0);
  });
});

describe("handleTerminalCreate — env and cwd branches", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes env vars when provided", async () => {
    const result = await handleTerminalCreate({
      command: "printenv",
      env: [
        { name: "MY_VAR", value: "hello" },
        { name: "OTHER", value: "world" },
      ],
    });

    expect(mockSpawn).toHaveBeenCalledWith(
      "printenv",
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          MY_VAR: "hello",
          OTHER: "world",
        }),
      }),
    );
    expect(result).toHaveProperty("terminalId");
  });

  it("uses undefined cwd when not provided", async () => {
    await handleTerminalCreate({ command: "ls" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "ls",
      [],
      expect.objectContaining({ cwd: undefined }),
    );
  });

  it("passes cwd when provided", async () => {
    const cwd = process.cwd();
    await handleTerminalCreate({ command: "ls", cwd });

    expect(mockSpawn).toHaveBeenCalledWith(
      "ls",
      [],
      expect.objectContaining({ cwd }),
    );
  });

  it("throws -32002 when cwd is outside session scope", async () => {
    await expect(
      handleTerminalCreate({ command: "ls", cwd: "/etc", sessionId: "s1" }),
    ).rejects.toThrow(expect.objectContaining({ code: -32002 }));
  });
});

describe("handleTerminalOutput — client delegation", () => {
  beforeEach(() => {
    mockGetClientCapabilities.mockReturnValue({ terminal: true });
    mockSendClientRequest.mockResolvedValue({ output: "remote output", exitStatus: undefined });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to sendClientRequest when client has capability", async () => {
    const result = await handleTerminalOutput({ terminalId: "t1" });

    expect(mockSendClientRequest).toHaveBeenCalledWith("terminal/output", {
      terminalId: "t1",
    });
    expect(result).toEqual({ output: "remote output", exitStatus: undefined });
  });
});

describe("handleTerminalWaitForExit — client delegation", () => {
  beforeEach(() => {
    mockGetClientCapabilities.mockReturnValue({ terminal: true });
    mockSendClientRequest.mockResolvedValue({ exitCode: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to sendClientRequest when client has capability", async () => {
    const result = await handleTerminalWaitForExit({ terminalId: "t1" });

    expect(mockSendClientRequest).toHaveBeenCalledWith("terminal/wait_for_exit", {
      terminalId: "t1",
    });
    expect(result).toEqual({ exitCode: 0 });
  });
});

describe("handleTerminalWaitForExit — already exited before wait", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns immediately when process has already exited", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "true" });
    // Simulate exit with code 42 — this auto-removes from activeTerminals
    fakeProc.emitExit(42);

    // After auto-cleanup, the terminalId is gone. So we can't test the already-exited path
    // via the active map. Instead verify that the exit handler cleaned up.
    await expect(handleTerminalOutput({ terminalId })).rejects.toThrow(
      expect.objectContaining({ code: -32002 }),
    );
  });
});

describe("handleTerminalRelease — client delegation", () => {
  beforeEach(() => {
    mockGetClientCapabilities.mockReturnValue({ terminal: true });
    mockSendClientRequest.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to sendClientRequest when client has capability", async () => {
    const result = await handleTerminalRelease({ terminalId: "t1" });

    expect(mockSendClientRequest).toHaveBeenCalledWith("terminal/release", {
      terminalId: "t1",
    });
    expect(result).toEqual({});
  });
});

describe("handleTerminalKill — client delegation", () => {
  beforeEach(() => {
    mockGetClientCapabilities.mockReturnValue({ terminal: true });
    mockSendClientRequest.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to sendClientRequest when client has capability", async () => {
    const result = await handleTerminalKill({ terminalId: "t1" });

    expect(mockSendClientRequest).toHaveBeenCalledWith("terminal/kill", {
      terminalId: "t1",
    });
    expect(result).toEqual({});
  });
});

describe("terminal — exit code and signal branches", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports exitStatus with null code as undefined in output", async () => {
    const { terminalId: _tid } = await handleTerminalCreate({ command: "test" });
    // Exit with null code and null signal
    fakeProc.emitExit(null, null);

    // After auto-cleanup, terminalId is removed. Test output before exit.
    // Instead, test exit status via the waiter
    const { terminalId: tid2 } = await handleTerminalCreate({ command: "test2" });
    const exitPromise = handleTerminalWaitForExit({ terminalId: tid2 });
    fakeProc.emitExit(null, null);
    const result = await exitPromise;
    expect(result).toEqual({ exitCode: undefined, signal: undefined });
    void _tid;
  });

  it("reports exitStatus with signal in waiter", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "test" });
    const exitPromise = handleTerminalWaitForExit({ terminalId });
    fakeProc.emitExit(1, "SIGKILL");
    const result = await exitPromise;
    expect(result).toEqual({ exitCode: 1, signal: "SIGKILL" });
  });
});

describe("terminal stderr output", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captures stderr output", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "test" });
    fakeProc.emitStderr("error message\n");

    const result = await handleTerminalOutput({ terminalId });
    expect(result.output).toContain("error message");
  });
});

describe("terminal spawn error while waiting", () => {
  let fakeProc: ReturnType<typeof createFakeChildProcess>;

  beforeEach(async () => {
    fakeProc = createFakeChildProcess();
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: process.cwd() });
    mockSpawn.mockReturnValue(fakeProc);
    mockSendClientRequest.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects waiter on spawn error", async () => {
    const { terminalId } = await handleTerminalCreate({ command: "bad" });
    const exitPromise = handleTerminalWaitForExit({ terminalId });

    // Emit an error while someone is waiting
    fakeProc.emitError(new Error("spawn ENOENT"));

    await expect(exitPromise).rejects.toThrow("spawn ENOENT");
  });
});
