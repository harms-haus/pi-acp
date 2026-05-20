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
});
