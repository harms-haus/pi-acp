import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture arguments passed to constructors and static methods
const mockAuthStorageInstance = { type: "authStorage" } as const;
const mockModelRegistryInstance = { type: "modelRegistry" } as const;
const mockSessionManagerInstance = { type: "sessionManager" } as const;
const mockAgentSessionInstance = { sessionId: "pi_sess_12345" } as const;

const mockAuthStorageCreate = vi.fn().mockReturnValue(mockAuthStorageInstance);
const mockModelRegistryCreate = vi.fn().mockReturnValue(mockModelRegistryInstance);
const mockSessionManagerInMemory = vi.fn().mockReturnValue(mockSessionManagerInstance);
const mockSessionManagerOpen = vi.fn().mockReturnValue(mockSessionManagerInstance);
const mockGetAgentDir = vi.fn().mockReturnValue("/home/user/.pi/agent");
const mockCreateAgentSession = vi.fn().mockResolvedValue({
  session: mockAgentSessionInstance,
});

// Track DefaultResourceLoader constructor args
let capturedLoaderOptions: unknown = null;

vi.mock("@earendil-works/pi-coding-agent", () => {
  return {
    AuthStorage: { create: (...args: unknown[]) => mockAuthStorageCreate(...args) },
    ModelRegistry: { create: (...args: unknown[]) => mockModelRegistryCreate(...args) },
    SessionManager: {
      inMemory: (...args: unknown[]) => mockSessionManagerInMemory(...args),
      open: (...args: unknown[]) => mockSessionManagerOpen(...args),
    },
    DefaultResourceLoader: class {
      constructor(opts: unknown) {
        capturedLoaderOptions = opts;
      }
      reload = vi.fn();
    },
    getAgentDir: (...args: unknown[]) => mockGetAgentDir(...args),
    createAgentSession: (...args: unknown[]) => mockCreateAgentSession(...args),
  };
});

vi.mock("../../src/pi/acp-extension.js", () => ({
  acpExtensionFactory: vi.fn(),
}));

import { createAcpSession } from "../../src/pi/sdk-factory.js";

import { acpExtensionFactory } from "../../src/pi/acp-extension.js";

const mockedAcpExtensionFactory = vi.mocked(acpExtensionFactory);

describe("createAcpSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedLoaderOptions = null;
  });

  // ── 1. Creates session with in-memory SessionManager when no sessionPath ──
  it("uses in-memory SessionManager when no sessionPath is provided", async () => {
    const result = await createAcpSession({ cwd: "/project" });

    expect(mockSessionManagerInMemory).toHaveBeenCalledOnce();
    expect(mockSessionManagerOpen).not.toHaveBeenCalled();
    expect(result.session).toBe(mockAgentSessionInstance);
    expect(result.sessionId).toBe("pi_sess_12345");
  });

  // ── 2. Creates session with file-backed SessionManager when sessionPath ──
  it("uses file-backed SessionManager when sessionPath is provided", async () => {
    const result = await createAcpSession({
      cwd: "/project",
      sessionPath: "/project/sessions/test.jsonl",
    });

    expect(mockSessionManagerOpen).toHaveBeenCalledWith("/project/sessions/test.jsonl");
    expect(mockSessionManagerInMemory).not.toHaveBeenCalled();
    expect(result.session).toBe(mockAgentSessionInstance);
    expect(result.sessionId).toBe("pi_sess_12345");
  });

  // ── 3. Passes correct options to createAgentSession ──────────────────────
  it("passes correct options to createAgentSession", async () => {
    await createAcpSession({ cwd: "/project" });

    expect(mockCreateAgentSession).toHaveBeenCalledOnce();
    const callArgs = mockCreateAgentSession.mock.calls[0][0] as Record<string, unknown>;

    expect(callArgs.cwd).toBe("/project");
    expect(callArgs.agentDir).toBe("/home/user/.pi/agent");
    expect(callArgs.authStorage).toBe(mockAuthStorageInstance);
    expect(callArgs.modelRegistry).toBe(mockModelRegistryInstance);
    expect(callArgs.sessionManager).toBe(mockSessionManagerInstance);
    // resourceLoader should be the constructed loader
    expect(callArgs.resourceLoader).toBeDefined();
  });

  // ── 4. Returns session and sessionId ──────────────────────────────────────
  it("returns session and sessionId from createAgentSession result", async () => {
    const result = await createAcpSession({ cwd: "/project" });

    expect(result).toEqual({
      session: mockAgentSessionInstance,
      sessionId: "pi_sess_12345",
    });
  });

  // ── 5. Passes acpExtensionFactory to resource loader ──────────────────────
  it("passes acpExtensionFactory to DefaultResourceLoader", async () => {
    await createAcpSession({ cwd: "/project" });

    expect(capturedLoaderOptions).toEqual({
      cwd: "/project",
      agentDir: "/home/user/.pi/agent",
      extensionFactories: [mockedAcpExtensionFactory],
    });
  });

  // ── 6. Creates auth storage and model registry ────────────────────────────
  it("creates AuthStorage and ModelRegistry", async () => {
    await createAcpSession({ cwd: "/project" });

    expect(mockAuthStorageCreate).toHaveBeenCalledOnce();
    expect(mockModelRegistryCreate).toHaveBeenCalledWith(mockAuthStorageInstance);
  });
});
