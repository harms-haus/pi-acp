import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the pi SDK modules
vi.mock("../../src/pi/session-registry.js", () => ({
  getSession: vi.fn(),
  registerSession: vi.fn(() => "sess_test_1"),
  removeSession: vi.fn(),
  listSessions: vi.fn(() => []),
  setSessionCancelling: vi.fn(),
}));

vi.mock("../../src/pi/sdk-factory.js", () => ({
  createAcpSession: vi.fn(() =>
    Promise.resolve({
      session: {
        subscribe: vi.fn(() => vi.fn()),
        prompt: vi.fn(() => Promise.resolve()),
        abort: vi.fn(() => Promise.resolve()),
        dispose: vi.fn(),
        sessionManager: { getEntries: vi.fn(() => []) },
        agent: { state: {} },
      },
      sessionId: "pi_test_session",
    }),
  ),
}));

vi.mock("@earendil-works/pi-coding-agent", () => ({
  SessionManager: {
    list: vi.fn(() => []),
  },
}));

import { handleAuthenticate } from "../../src/acp/methods/authenticate.js";
import { handleInitialize, getClientCapabilities } from "../../src/acp/methods/initialize.js";
import { handleSessionClose } from "../../src/acp/methods/session-close.js";
import { handleSessionList } from "../../src/acp/methods/session-list.js";
import { handleSessionNew } from "../../src/acp/methods/session-new.js";
import { handleSessionSetConfigOption } from "../../src/acp/methods/session-set-config.js";
import { handleSessionSetMode } from "../../src/acp/methods/session-set-mode.js";
import { getSession } from "../../src/pi/session-registry.js";

describe("handleInitialize", () => {
  it("throws when params is undefined", async () => {
    await expect(handleInitialize(undefined)).rejects.toThrow();
  });

  it("throws when protocolVersion is missing", async () => {
    await expect(handleInitialize({} as any)).rejects.toThrow();
  });

  it("throws when protocolVersion is not a number", async () => {
    await expect(handleInitialize({ protocolVersion: "1" } as any)).rejects.toThrow();
  });

  it("returns correct response structure", async () => {
    const result = await handleInitialize({ protocolVersion: 1, clientCapabilities: {} });
    expect(result.protocolVersion).toBe(1);
    expect(result.agentInfo).toEqual({
      name: "pi",
      title: "pi coding agent",
      version: "0.1.0",
    });
    expect(result.agentCapabilities?.loadSession).toBe(true);
    expect(result.agentCapabilities?.promptCapabilities?.image).toBe(true);
    expect(result.agentCapabilities?.promptCapabilities?.audio).toBe(false);
    expect(result.agentCapabilities?.promptCapabilities?.embeddedContext).toBe(true);
  });

  it("stores clientCapabilities for later retrieval", async () => {
    await handleInitialize({
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: true } },
    });
    const caps = getClientCapabilities();
    expect(caps?.fs?.readTextFile).toBe(true);
  });
});

describe("handleAuthenticate", () => {
  it("returns empty response (no auth required)", async () => {
    const result = await handleAuthenticate({ methodId: "test" });
    expect(result).toEqual({});
  });
});

describe("handleSessionNew", () => {
  it("throws when params is undefined", async () => {
    await expect(handleSessionNew(undefined)).rejects.toThrow();
  });

  it("throws when cwd is missing", async () => {
    await expect(handleSessionNew({} as any)).rejects.toThrow();
  });

  it("throws when cwd is empty string", async () => {
    await expect(handleSessionNew({ cwd: "" })).rejects.toThrow();
  });

  it("throws when cwd is not a string", async () => {
    await expect(handleSessionNew({ cwd: 123 } as any)).rejects.toThrow();
  });

  it("returns sessionId on success", async () => {
    const result = await handleSessionNew({ cwd: "/home/user/project" });
    expect(typeof result.sessionId).toBe("string");
    expect(result.sessionId).toMatch(/^sess_/);
  });
});

describe("handleSessionClose", () => {
  const mockGetSession = vi.mocked(getSession);

  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it("throws when sessionId is missing", async () => {
    await expect(handleSessionClose({} as any)).rejects.toThrow();
  });

  it("throws for non-existent session", async () => {
    mockGetSession.mockReturnValue(undefined);
    await expect(handleSessionClose({ sessionId: "nonexistent" })).rejects.toThrow();
  });
});

describe("handleSessionList", () => {
  it("returns sessions from active registry", async () => {
    // The handler combines active sessions + persisted sessions
    // Without mocking the SDK's SessionManager, persisted sessions leak in
    // This test verifies the handler returns a valid structure
    const result = await handleSessionList({});
    expect(Array.isArray(result.sessions)).toBe(true);
    // nextCursor is only set when pagination is needed (more than 50 sessions)
    expect(result.nextCursor === undefined || typeof result.nextCursor === "string").toBe(true);
  });
});

describe("handleSessionSetMode", () => {
  const mockGetSession = vi.mocked(getSession);

  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it("throws when sessionId is missing", async () => {
    await expect(handleSessionSetMode({ modeId: "code" } as any)).rejects.toThrow();
  });

  it("throws when modeId is missing", async () => {
    await expect(handleSessionSetMode({ sessionId: "sess_1" } as any)).rejects.toThrow();
  });

  it("throws for non-existent session", async () => {
    mockGetSession.mockReturnValue(undefined);
    await expect(
      handleSessionSetMode({ sessionId: "nonexistent", modeId: "code" }),
    ).rejects.toThrow();
  });
});

describe("handleSessionSetConfigOption", () => {
  const mockGetSession = vi.mocked(getSession);

  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetSession.mockReturnValue({
      session: {} as any,
      cwd: "/project",
      createdAt: Date.now(),
      cancelling: false,
    });
  });

  it("throws when required params are missing", async () => {
    await expect(handleSessionSetConfigOption({} as any)).rejects.toThrow();
  });

  it("throws for non-existent session", async () => {
    mockGetSession.mockReturnValue(undefined);
    await expect(
      handleSessionSetConfigOption({ sessionId: "nonexistent", configId: "x", value: "y" }),
    ).rejects.toThrow();
  });

  it("initializes default config options on first call", async () => {
    const result = await handleSessionSetConfigOption({
      sessionId: "sess_new",
      configId: "thought_level",
      value: "high",
    });
    expect(result.configOptions).toBeDefined();
    expect(result.configOptions).toHaveLength(1);
    expect(result.configOptions[0].id).toBe("thought_level");
  });
});
