import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
const mockGetSession = vi.fn();
const mockRegisterSession = vi.fn();
const mockCreateAcpSession = vi.fn();
const mockWriteNotification = vi.fn();
const mockPiContentToAcpBlocks = vi.fn();
const mockResolveAndValidatePath = vi.fn();
const mockAssertWithinSandbox = vi.fn();
const mockRealpathSync = vi.fn();

// Mock throwAcpError to actually throw
vi.mock("../../src/utils/error-codes.js", () => ({
  throwAcpError: vi.fn((code: number, message: string): never => {
    const error = new Error(message) as Error & { code: number };
    error.code = code;
    throw error;
  }),
}));

vi.mock("../../src/utils/param-validation.js", () => ({
  requireParams: vi.fn((params: unknown, keys: string[]) => {
    if (
      params === undefined ||
      params === null ||
      typeof params !== "object" ||
      Array.isArray(params)
    ) {
      const error = new Error("Invalid params: expected an object") as Error & { code: number };
      error.code = -32602;
      throw error;
    }
    const obj = params as Record<string, unknown>;
    for (const key of keys) {
      if (!(key in obj)) {
        const error = new Error(`Invalid params: missing '${key}'`) as Error & { code: number };
        error.code = -32602;
        throw error;
      }
    }
    return params;
  }),
}));

vi.mock("../../src/pi/session-registry.js", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  registerSession: (...args: unknown[]) => mockRegisterSession(...args),
}));

vi.mock("../../src/pi/sdk-factory.js", () => ({
  createAcpSession: (...args: unknown[]) => mockCreateAcpSession(...args),
}));

vi.mock("../../src/transport/stdio.js", () => ({
  writeNotification: (...args: unknown[]) => mockWriteNotification(...args),
}));

vi.mock("../../src/utils/content-translation.js", () => ({
  piContentToAcpBlocks: (...args: unknown[]) => mockPiContentToAcpBlocks(...args),
}));

vi.mock("../../src/utils/path-validation.js", () => ({
  resolveAndValidatePath: (...args: unknown[]) => mockResolveAndValidatePath(...args),
  assertWithinSandbox: (...args: unknown[]) => mockAssertWithinSandbox(...args),
}));

vi.mock("node:fs", () => ({
  realpathSync: (...args: unknown[]) => mockRealpathSync(...args),
}));

import { handleSessionLoad } from "../../src/acp/methods/session-load.js";

describe("handleSessionLoad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Throws when sessionId is missing ───────────────────────────────────
  it("throws -32602 when sessionId is missing", async () => {
    await expect(handleSessionLoad({ cwd: "/tmp" })).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  // ── 2. Throws when cwd is missing ─────────────────────────────────────────
  it("throws -32602 when cwd is missing", async () => {
    await expect(handleSessionLoad({ sessionId: "sess_1" })).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  // ── 3. Replays history when session already registered ────────────────────
  it("replays history when session already registered (getSession returns entry)", async () => {
    const mockGetEntries = vi.fn(() => [
      {
        type: "message",
        id: "msg_1",
        message: { role: "user", content: "Hello" },
      },
    ]);
    mockGetSession.mockReturnValue({
      session: { sessionManager: { getEntries: mockGetEntries } },
      cwd: "/tmp",
      createdAt: Date.now(),
      cancelling: false,
    });
    mockPiContentToAcpBlocks.mockReturnValue([{ type: "text", text: "Hello" }]);

    const result = await handleSessionLoad({ sessionId: "sess_active", cwd: "/tmp" });

    expect(result).toEqual({});
    expect(mockGetSession).toHaveBeenCalledWith("sess_active");
    expect(mockGetEntries).toHaveBeenCalled();
    expect(mockWriteNotification).toHaveBeenCalled();
    // Should NOT call createAcpSession since session already exists
    expect(mockCreateAcpSession).not.toHaveBeenCalled();
  });

  // ── 4. Creates new session from file path when sessionId ends with .jsonl ─
  it("creates new session from file when sessionId ends with .jsonl", async () => {
    mockGetSession.mockReturnValue(undefined);
    mockResolveAndValidatePath.mockReturnValue("/project/sessions/test.jsonl");
    mockRealpathSync.mockImplementation((p: string) => p);
    mockAssertWithinSandbox.mockReturnValue(undefined);
    mockCreateAcpSession.mockResolvedValue({
      session: {
        sessionManager: { getEntries: vi.fn(() => []) },
      },
      sessionId: "pi_new_session",
    });

    const result = await handleSessionLoad({
      sessionId: "test.jsonl",
      cwd: "/project",
    });

    expect(result).toEqual({});
    expect(mockResolveAndValidatePath).toHaveBeenCalledWith("test.jsonl", "/project");
    expect(mockCreateAcpSession).toHaveBeenCalledWith({
      cwd: "/project",
      sessionPath: "/project/sessions/test.jsonl",
    });
    expect(mockRegisterSession).toHaveBeenCalled();
  });

  // ── 5. Creates new session from file path when sessionId contains / ───────
  it("creates new session from file when sessionId contains /", async () => {
    mockGetSession.mockReturnValue(undefined);
    mockResolveAndValidatePath.mockReturnValue("/project/sessions/deep/session.jsonl");
    mockRealpathSync.mockImplementation((p: string) => p);
    mockAssertWithinSandbox.mockReturnValue(undefined);
    mockCreateAcpSession.mockResolvedValue({
      session: {
        sessionManager: { getEntries: vi.fn(() => []) },
      },
      sessionId: "pi_path_session",
    });

    const result = await handleSessionLoad({
      sessionId: "sessions/deep/session.jsonl",
      cwd: "/project",
    });

    expect(result).toEqual({});
    expect(mockResolveAndValidatePath).toHaveBeenCalledWith(
      "sessions/deep/session.jsonl",
      "/project",
    );
    expect(mockCreateAcpSession).toHaveBeenCalledWith({
      cwd: "/project",
      sessionPath: "/project/sessions/deep/session.jsonl",
    });
  });

  // ── 6. Throws when session not found and path is invalid ──────────────────
  it("throws -32002 when session not found and sessionId has no .jsonl or /", async () => {
    mockGetSession.mockReturnValue(undefined);

    await expect(
      handleSessionLoad({ sessionId: "plain_id", cwd: "/project" }),
    ).rejects.toThrow(expect.objectContaining({ code: -32002 }));
  });

  // ── 7. Replays user and assistant messages with tool calls ────────────────
  it("replays user messages, assistant messages, and tool calls from history", async () => {
    const mockGetEntries = vi.fn(() => [
      {
        type: "message",
        id: "msg_user_1",
        message: { role: "user", content: "Write hello" },
      },
      {
        type: "message",
        id: "msg_assistant_1",
        message: { role: "assistant", content: "Done" },
        toolCalls: [
          { id: "tc_1", name: "write_file", kind: "write" },
          "tc_string_id",
        ],
      },
    ]);
    mockGetSession.mockReturnValue({
      session: { sessionManager: { getEntries: mockGetEntries } },
      cwd: "/tmp",
      createdAt: Date.now(),
      cancelling: false,
    });
    mockPiContentToAcpBlocks.mockImplementation((content) => [
      { type: "text", text: String(content) },
    ]);

    await handleSessionLoad({ sessionId: "sess_history", cwd: "/tmp" });

    // user message chunk + assistant message chunk + 2 tool calls = 4 notifications
    expect(mockWriteNotification).toHaveBeenCalledTimes(4);

    // Verify user message chunk
    expect(mockWriteNotification).toHaveBeenNthCalledWith(1, "session/update", {
      sessionId: "sess_history",
      update: {
        sessionUpdate: "user_message_chunk",
        content: {
          content: { type: "text", text: "Write hello" },
          messageId: "msg_user_1",
        },
      },
    });

    // Verify assistant message chunk
    expect(mockWriteNotification).toHaveBeenNthCalledWith(2, "session/update", {
      sessionId: "sess_history",
      update: {
        sessionUpdate: "agent_message_chunk",
        content: {
          content: { type: "text", text: "Done" },
          messageId: "msg_assistant_1",
        },
      },
    });

    // Verify tool call with object
    expect(mockWriteNotification).toHaveBeenNthCalledWith(3, "session/update", {
      sessionId: "sess_history",
      update: {
        sessionUpdate: "tool_call",
        toolCall: {
          toolCallId: "tc_1",
          title: "write_file",
          kind: "write",
          status: "completed",
        },
      },
    });

    // Verify tool call with string
    expect(mockWriteNotification).toHaveBeenNthCalledWith(4, "session/update", {
      sessionId: "sess_history",
      update: {
        sessionUpdate: "tool_call",
        toolCall: {
          toolCallId: "tc_string_id",
          title: "Tool call",
          status: "completed",
        },
      },
    });
  });

  // ── 8. Skips non-message entries in history ───────────────────────────────
  it("skips non-message entries during history replay", async () => {
    const mockGetEntries = vi.fn(() => [
      { type: "tool_result", id: "tr_1" },
      { type: "message", id: "msg_1", message: { role: "user", content: "Hi" } },
    ]);
    mockGetSession.mockReturnValue({
      session: { sessionManager: { getEntries: mockGetEntries } },
      cwd: "/tmp",
      createdAt: Date.now(),
      cancelling: false,
    });
    mockPiContentToAcpBlocks.mockReturnValue([{ type: "text", text: "Hi" }]);

    await handleSessionLoad({ sessionId: "sess_mixed", cwd: "/tmp" });

    // Only 1 notification for the message entry
    expect(mockWriteNotification).toHaveBeenCalledTimes(1);
  });
});
