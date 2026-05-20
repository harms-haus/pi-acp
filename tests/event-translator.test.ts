import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────
// Mock factories are hoisted to the top — must NOT reference external variables.

vi.mock("../src/transport/stdio.js", () => ({
  writeNotification: vi.fn(),
  writeResponse: vi.fn(),
}));

vi.mock("../src/utils/turn-id.js", () => ({
  generateTurnId: vi.fn(),
}));

vi.mock("../src/utils/content-translation.js", () => ({
  toolNameToKind: vi.fn(),
  kindToTitle: vi.fn(),
  piContentToAcpBlocks: vi.fn(),
  piToolResultToAcpContent: vi.fn(),
}));

vi.mock("../src/pi/session-registry.js", () => ({
  getTurnId: vi.fn(),
  setTurnId: vi.fn(),
  isSessionCancelling: vi.fn(),
  setSessionCancelling: vi.fn(),
  getPromptRequestId: vi.fn(),
  setPromptRequestId: vi.fn(),
}));

// Import the SUT after mocks are in place
import { handlePiEvent, cleanupSession } from "../src/pi/event-translator.js";
import { writeNotification, writeResponse } from "../src/transport/stdio.js";
import { generateTurnId } from "../src/utils/turn-id.js";
import {
  toolNameToKind,
  kindToTitle,
  piContentToAcpBlocks,
  piToolResultToAcpContent,
} from "../src/utils/content-translation.js";
import {
  getTurnId,
  setTurnId,
  isSessionCancelling,
  setSessionCancelling,
  getPromptRequestId,
  setPromptRequestId,
} from "../src/pi/session-registry.js";

import { CLIENT_METHODS, AGENT_THOUGHT_CHUNK_TYPE } from "../src/acp/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SESSION_ID = "sess_test_123";

/** Shorthand to extract all writeNotification calls as parsed params. */
function getNotifications(): { method: string; params: unknown }[] {
  return (writeNotification as ReturnType<typeof vi.fn>).mock.calls.map(
    (call: any[]) => ({ method: call[0] as string, params: call[1] }),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  (generateTurnId as ReturnType<typeof vi.fn>).mockReturnValue("turn-mock-1");
  (getTurnId as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
});

// ── agent_start ──────────────────────────────────────────────────────────────

describe("handlePiEvent — agent_start", () => {
  it("generates a turn ID and stores it via setTurnId", () => {
    handlePiEvent({ type: "agent_start" } as any, SESSION_ID);
    expect(generateTurnId).toHaveBeenCalledOnce();
    expect(setTurnId).toHaveBeenCalledWith(SESSION_ID, "turn-mock-1");
  });
});

// ── agent_end ────────────────────────────────────────────────────────────────

describe("handlePiEvent — agent_end", () => {
  it("does nothing when session is not cancelling", () => {
    (isSessionCancelling as ReturnType<typeof vi.fn>).mockReturnValue(false);
    handlePiEvent({ type: "agent_end" } as any, SESSION_ID);
    expect(writeResponse).not.toHaveBeenCalled();
    expect(setSessionCancelling).not.toHaveBeenCalled();
  });

  it("sends cancelled response when session is cancelling with a promptRequestId", () => {
    (isSessionCancelling as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getPromptRequestId as ReturnType<typeof vi.fn>).mockReturnValue(42);
    handlePiEvent({ type: "agent_end" } as any, SESSION_ID);
    expect(setSessionCancelling).toHaveBeenCalledWith(SESSION_ID, false);
    expect(writeResponse).toHaveBeenCalledWith(42, { stopReason: "cancelled" });
    expect(setPromptRequestId).toHaveBeenCalledWith(SESSION_ID, null);
  });

  it("does not send response when cancelling but no promptRequestId", () => {
    (isSessionCancelling as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getPromptRequestId as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    handlePiEvent({ type: "agent_end" } as any, SESSION_ID);
    expect(setSessionCancelling).toHaveBeenCalledWith(SESSION_ID, false);
    expect(writeResponse).not.toHaveBeenCalled();
  });
});

// ── message_update (text_delta) ──────────────────────────────────────────────

describe("handlePiEvent — message_update with text_delta", () => {
  it("sends agent_message_chunk notification", () => {
    (getTurnId as ReturnType<typeof vi.fn>).mockReturnValue("turn-1");
    handlePiEvent(
      {
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", delta: "hello world" },
      } as any,
      SESSION_ID,
    );
    const notifs = getNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].method).toBe(CLIENT_METHODS.SESSION_UPDATE);
    expect(notifs[0].params).toEqual({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "hello world" },
      },
    });
  });

  it("does nothing when turnId is undefined", () => {
    (getTurnId as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    handlePiEvent(
      {
        type: "message_update",
        assistantMessageEvent: { type: "text_delta", delta: "ignored" },
      } as any,
      SESSION_ID,
    );
    expect(writeNotification).not.toHaveBeenCalled();
  });
});

// ── message_update (thinking_delta) ──────────────────────────────────────────

describe("handlePiEvent — message_update with thinking_delta", () => {
  it("sends agent_thought_chunk notification", () => {
    (getTurnId as ReturnType<typeof vi.fn>).mockReturnValue("turn-1");
    handlePiEvent(
      {
        type: "message_update",
        assistantMessageEvent: { type: "thinking_delta", delta: "hmm..." },
      } as any,
      SESSION_ID,
    );
    const notifs = getNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].params).toEqual({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: AGENT_THOUGHT_CHUNK_TYPE,
        content: { type: "text", text: "hmm..." },
      },
    });
  });
});

// ── message_start ────────────────────────────────────────────────────────────

describe("handlePiEvent — message_start", () => {
  it("sends user_message_chunk for user role messages", () => {
    (piContentToAcpBlocks as ReturnType<typeof vi.fn>).mockReturnValue([
      { type: "text", text: "user says hi" },
    ]);
    handlePiEvent(
      {
        type: "message_start",
        message: { role: "user", content: "user says hi" },
      } as any,
      SESSION_ID,
    );
    const notifs = getNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].params).toEqual({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "user says hi" },
      },
    });
  });

  it("sends multiple user_message_chunk for multiple content blocks", () => {
    (piContentToAcpBlocks as ReturnType<typeof vi.fn>).mockReturnValue([
      { type: "text", text: "part 1" },
      { type: "text", text: "part 2" },
    ]);
    handlePiEvent(
      {
        type: "message_start",
        message: { role: "user", content: "anything" },
      } as any,
      SESSION_ID,
    );
    expect(writeNotification).toHaveBeenCalledTimes(2);
  });

  it("does nothing for assistant role", () => {
    handlePiEvent(
      {
        type: "message_start",
        message: { role: "assistant", content: "hello" },
      } as any,
      SESSION_ID,
    );
    expect(writeNotification).not.toHaveBeenCalled();
  });
});

// ── message_end ──────────────────────────────────────────────────────────────

describe("handlePiEvent — message_end", () => {
  it("does not crash for assistant role with a turnId", () => {
    (getTurnId as ReturnType<typeof vi.fn>).mockReturnValue("turn-1");
    (piContentToAcpBlocks as ReturnType<typeof vi.fn>).mockReturnValue([
      { type: "text", text: "done" },
    ]);
    handlePiEvent(
      {
        type: "message_end",
        message: { role: "assistant", content: "done" },
      } as any,
      SESSION_ID,
    );
    // The current implementation does not send notifications in message_end
    expect(writeNotification).not.toHaveBeenCalled();
  });

  it("does nothing for user role", () => {
    handlePiEvent(
      {
        type: "message_end",
        message: { role: "user", content: "hi" },
      } as any,
      SESSION_ID,
    );
    expect(writeNotification).not.toHaveBeenCalled();
  });
});

// ── tool_execution_start ─────────────────────────────────────────────────────

describe("handlePiEvent — tool_execution_start", () => {
  it("sends tool_call then tool_call_update with in_progress", () => {
    (toolNameToKind as ReturnType<typeof vi.fn>).mockReturnValue("read");
    (kindToTitle as ReturnType<typeof vi.fn>).mockReturnValue("read: /foo.ts");
    handlePiEvent(
      {
        type: "tool_execution_start",
        toolCallId: "tc_1",
        toolName: "read",
        args: { path: "/foo.ts" },
      } as any,
      SESSION_ID,
    );
    const notifs = getNotifications();
    // First notification: tool_call
    expect(notifs[0].method).toBe(CLIENT_METHODS.SESSION_UPDATE);
    expect(notifs[0].params).toEqual({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "tc_1",
        title: "read: /foo.ts",
        kind: "read",
        status: "pending",
        rawInput: { path: "/foo.ts" },
      },
    });
    // Second notification: tool_call_update (in_progress)
    expect(notifs[1].params).toEqual({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "tc_1",
        status: "in_progress",
      },
    });
  });
});

// ── tool_execution_update ────────────────────────────────────────────────────

describe("handlePiEvent — tool_execution_update", () => {
  it("sends tool_call_update with partial content when tool call is tracked", () => {
    // First, register the tool call via tool_execution_start
    (toolNameToKind as ReturnType<typeof vi.fn>).mockReturnValue("read");
    (kindToTitle as ReturnType<typeof vi.fn>).mockReturnValue("read: /foo.ts");
    handlePiEvent(
      {
        type: "tool_execution_start",
        toolCallId: "tc_1",
        toolName: "read",
        args: { path: "/foo.ts" },
      } as any,
      SESSION_ID,
    );
    (writeNotification as ReturnType<typeof vi.fn>).mockClear();

    // Now simulate an update
    (piToolResultToAcpContent as ReturnType<typeof vi.fn>).mockReturnValue([
      { type: "content", content: { type: "text", text: "partial" } },
    ]);
    handlePiEvent(
      {
        type: "tool_execution_update",
        toolCallId: "tc_1",
        toolName: "read",
        partialResult: "partial output",
      } as any,
      SESSION_ID,
    );
    const notifs = getNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].params).toEqual({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "tc_1",
        status: "in_progress",
        content: [{ type: "content", content: { type: "text", text: "partial" } }],
      },
    });
  });

  it("does nothing when tool call is not tracked", () => {
    handlePiEvent(
      {
        type: "tool_execution_update",
        toolCallId: "tc_unknown",
        toolName: "read",
        partialResult: "data",
      } as any,
      SESSION_ID,
    );
    expect(writeNotification).not.toHaveBeenCalled();
  });

  it("sends tool_call_update without content when partialResult is undefined", () => {
    // Register tool call first
    (toolNameToKind as ReturnType<typeof vi.fn>).mockReturnValue("bash");
    (kindToTitle as ReturnType<typeof vi.fn>).mockReturnValue("execute: ls");
    handlePiEvent(
      {
        type: "tool_execution_start",
        toolCallId: "tc_2",
        toolName: "bash",
        args: { command: "ls" },
      } as any,
      SESSION_ID,
    );
    (writeNotification as ReturnType<typeof vi.fn>).mockClear();

    handlePiEvent(
      {
        type: "tool_execution_update",
        toolCallId: "tc_2",
        toolName: "bash",
      } as any,
      SESSION_ID,
    );
    const notifs = getNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].params).toEqual({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "tc_2",
        status: "in_progress",
        content: undefined,
      },
    });
  });
});

// ── tool_execution_end ───────────────────────────────────────────────────────

describe("handlePiEvent — tool_execution_end", () => {
  beforeEach(() => {
    // Register a tool call for each test
    (toolNameToKind as ReturnType<typeof vi.fn>).mockReturnValue("read");
    (kindToTitle as ReturnType<typeof vi.fn>).mockReturnValue("read: /foo.ts");
    handlePiEvent(
      {
        type: "tool_execution_start",
        toolCallId: "tc_1",
        toolName: "read",
        args: { path: "/foo.ts" },
      } as any,
      SESSION_ID,
    );
    (writeNotification as ReturnType<typeof vi.fn>).mockClear();
  });

  it("sends tool_call_update with status completed on success", () => {
    (piToolResultToAcpContent as ReturnType<typeof vi.fn>).mockReturnValue([]);
    handlePiEvent(
      {
        type: "tool_execution_end",
        toolCallId: "tc_1",
        toolName: "read",
        result: { content: "file content" },
        isError: false,
      } as any,
      SESSION_ID,
    );
    const notifs = getNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].params).toMatchObject({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "tc_1",
        status: "completed",
      },
    });
    expect(piToolResultToAcpContent).toHaveBeenCalledWith("read", "file content", undefined);
  });

  it("sends tool_call_update with status failed on error", () => {
    (piToolResultToAcpContent as ReturnType<typeof vi.fn>).mockReturnValue([]);
    handlePiEvent(
      {
        type: "tool_execution_end",
        toolCallId: "tc_1",
        toolName: "read",
        result: { content: "error message" },
        isError: true,
      } as any,
      SESSION_ID,
    );
    const notifs = getNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].params).toMatchObject({
      sessionId: SESSION_ID,
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "tc_1",
        status: "failed",
      },
    });
  });

  it("passes details to piToolResultToAcpContent when result has details object", () => {
    (piToolResultToAcpContent as ReturnType<typeof vi.fn>).mockReturnValue([]);
    const details = { path: "/a.ts", oldText: "foo", newText: "bar" };
    handlePiEvent(
      {
        type: "tool_execution_end",
        toolCallId: "tc_1",
        toolName: "edit",
        result: { content: "edited", details },
        isError: false,
      } as any,
      SESSION_ID,
    );
    expect(piToolResultToAcpContent).toHaveBeenCalledWith("edit", "edited", details);
  });

  it("does nothing when tool call is not tracked", () => {
    handlePiEvent(
      {
        type: "tool_execution_end",
        toolCallId: "tc_unknown",
        toolName: "read",
        result: {},
        isError: false,
      } as any,
      SESSION_ID,
    );
    expect(writeNotification).not.toHaveBeenCalled();
  });
});

// ── turn_start ───────────────────────────────────────────────────────────────

describe("handlePiEvent — turn_start", () => {
  it("generates and sets a turn ID when none exists", () => {
    (getTurnId as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    handlePiEvent({ type: "turn_start" } as any, SESSION_ID);
    expect(generateTurnId).toHaveBeenCalledOnce();
    expect(setTurnId).toHaveBeenCalledWith(SESSION_ID, "turn-mock-1");
  });

  it("does not generate a turn ID when one already exists", () => {
    (getTurnId as ReturnType<typeof vi.fn>).mockReturnValue("turn-existing");
    handlePiEvent({ type: "turn_start" } as any, SESSION_ID);
    expect(generateTurnId).not.toHaveBeenCalled();
    expect(setTurnId).not.toHaveBeenCalled();
  });
});

// ── turn_end ─────────────────────────────────────────────────────────────────

describe("handlePiEvent — turn_end", () => {
  it("removes tracked tool calls for the session", () => {
    // Register a tool call first
    (toolNameToKind as ReturnType<typeof vi.fn>).mockReturnValue("read");
    (kindToTitle as ReturnType<typeof vi.fn>).mockReturnValue("read: /foo.ts");
    handlePiEvent(
      {
        type: "tool_execution_start",
        toolCallId: "tc_1",
        toolName: "read",
        args: { path: "/foo.ts" },
      } as any,
      SESSION_ID,
    );

    // Now turn_end should clean up the tracked tool call
    handlePiEvent(
      {
        type: "turn_end",
        toolResults: [{ toolCallId: "tc_1" }],
      } as any,
      SESSION_ID,
    );

    // After turn_end, a tool_execution_update for the same toolCallId should be ignored
    (writeNotification as ReturnType<typeof vi.fn>).mockClear();
    handlePiEvent(
      {
        type: "tool_execution_update",
        toolCallId: "tc_1",
        toolName: "read",
        partialResult: "should be ignored",
      } as any,
      SESSION_ID,
    );
    expect(writeNotification).not.toHaveBeenCalled();
  });
});

// ── compaction_start / compaction_end ────────────────────────────────────────

describe("handlePiEvent — compaction events", () => {
  it("compaction_start is a no-op", () => {
    handlePiEvent({ type: "compaction_start" } as any, SESSION_ID);
    expect(writeNotification).not.toHaveBeenCalled();
    expect(setTurnId).not.toHaveBeenCalled();
  });

  it("compaction_end is a no-op", () => {
    handlePiEvent({ type: "compaction_end" } as any, SESSION_ID);
    expect(writeNotification).not.toHaveBeenCalled();
    expect(setTurnId).not.toHaveBeenCalled();
  });
});

// ── cleanupSession ───────────────────────────────────────────────────────────

describe("cleanupSession", () => {
  it("removes active tool call tracking for the session", () => {
    // Register a tool call
    (toolNameToKind as ReturnType<typeof vi.fn>).mockReturnValue("bash");
    (kindToTitle as ReturnType<typeof vi.fn>).mockReturnValue("execute: ls");
    handlePiEvent(
      {
        type: "tool_execution_start",
        toolCallId: "tc_cleanup",
        toolName: "bash",
        args: { command: "ls" },
      } as any,
      SESSION_ID,
    );

    // After cleanup, updates for that tool call should be ignored
    cleanupSession(SESSION_ID);
    (writeNotification as ReturnType<typeof vi.fn>).mockClear();

    handlePiEvent(
      {
        type: "tool_execution_update",
        toolCallId: "tc_cleanup",
        toolName: "bash",
        partialResult: "ignored",
      } as any,
      SESSION_ID,
    );
    expect(writeNotification).not.toHaveBeenCalled();
  });
});
