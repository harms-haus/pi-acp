// Event translator — converts pi SDK events to ACP session/update notifications.
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

import {
  CLIENT_METHODS,
  AGENT_THOUGHT_CHUNK_TYPE,
  type SessionId,
  type SessionUpdate,
  type ToolCall,
  type ToolCallUpdate,
} from "../acp/types.js";
import { writeNotification, writeResponse } from "../transport/stdio.js";
import {
  piContentToAcpBlocks,
  toolNameToKind,
  kindToTitle,
  piToolResultToAcpContent,
} from "../utils/content-translation.js";
import { generateTurnId } from "../utils/turn-id.js";

import {
  getTurnId,
  setTurnId,
  isSessionCancelling,
  setSessionCancelling,
  getPromptRequestId,
  setPromptRequestId,
} from "./session-registry.js";

// Narrowed event types via discriminated union extraction
type MessageUpdateEvent = Extract<AgentSessionEvent, { type: "message_update" }>;
type MessageStartEvent = Extract<AgentSessionEvent, { type: "message_start" }>;
type MessageEndEvent = Extract<AgentSessionEvent, { type: "message_end" }>;
type ToolExecStartEvent = Extract<AgentSessionEvent, { type: "tool_execution_start" }>;
type ToolExecUpdateEvent = Extract<AgentSessionEvent, { type: "tool_execution_update" }>;
type ToolExecEndEvent = Extract<AgentSessionEvent, { type: "tool_execution_end" }>;
type TurnEndEvent = Extract<AgentSessionEvent, { type: "turn_end" }>;

// Track active tool calls per session to correlate start → update → end
const activeToolCalls = new Map<string, Map<string, ToolCall>>(); // sessionId → (toolCallId → ToolCall)

function getActiveToolCalls(sessionId: string): Map<string, ToolCall> {
  let map = activeToolCalls.get(sessionId);
  if (!map) {
    map = new Map();
    activeToolCalls.set(sessionId, map);
  }
  return map;
}

/** Send an ACP session/update notification. */
function sendUpdate(sessionId: SessionId, update: SessionUpdate): void {
  writeNotification(CLIENT_METHODS.SESSION_UPDATE, { sessionId, update });
}

function handleAgentEnd(sessionId: SessionId): void {
  const cancelling = isSessionCancelling(sessionId);
  if (!cancelling) return;
  setSessionCancelling(sessionId, false);
  const reqId = getPromptRequestId(sessionId);
  if (reqId !== undefined) {
    writeResponse(reqId, { stopReason: "cancelled" });
    setPromptRequestId(sessionId, null);
  }
}

function handleMessageUpdate(event: MessageUpdateEvent, sessionId: SessionId): void {
  const turnId = getTurnId(sessionId);
  if (turnId === undefined) return;
  const ame = event.assistantMessageEvent;
  if (ame.type === "text_delta") {
    sendUpdate(sessionId, {
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: ame.delta },
    });
  } else if (ame.type === "thinking_delta") {
    sendUpdate(sessionId, {
      sessionUpdate: AGENT_THOUGHT_CHUNK_TYPE,
      content: { type: "text", text: ame.delta },
    });
  }
}

function handleMessageStart(event: MessageStartEvent, sessionId: SessionId): void {
  if (event.message.role !== "user") return;
  const blocks = piContentToAcpBlocks(event.message.content);
  for (const block of blocks) {
    sendUpdate(sessionId, {
      sessionUpdate: "user_message_chunk",
      content: block,
    });
  }
}

function handleMessageEnd(event: MessageEndEvent, sessionId: SessionId): void {
  if (event.message.role !== "assistant") return;
  const turnId = getTurnId(sessionId);
  if (turnId !== undefined) {
    // Finalize the assistant message — send a last chunk with accumulated content
    const textContent = piContentToAcpBlocks(event.message.content);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _block of textContent) {
      // Don't re-send all chunks — just send the final content as part of the message_end
      // The individual deltas have already been streamed via message_update
    }
  }
  // Turn end detection is handled by agent_end event
}

function handleToolExecutionStart(event: ToolExecStartEvent, sessionId: SessionId): void {
  const kind = toolNameToKind(event.toolName);
  const toolCall: ToolCall = {
    toolCallId: event.toolCallId,
    title: kindToTitle(kind, event.args),
    kind,
    status: "pending",
    rawInput: event.args,
  };
  getActiveToolCalls(sessionId).set(event.toolCallId, toolCall);
  sendUpdate(sessionId, {
    sessionUpdate: "tool_call",
    ...toolCall,
  });
  // Mark as in_progress
  sendUpdate(sessionId, {
    sessionUpdate: "tool_call_update",
    toolCallId: event.toolCallId,
    status: "in_progress",
  });
}

function handleToolExecutionUpdate(event: ToolExecUpdateEvent, sessionId: SessionId): void {
  const existing = getActiveToolCalls(sessionId).get(event.toolCallId);
  if (!existing) return;
  // Send partial result update
  const content =
    event.partialResult !== undefined
      ? piToolResultToAcpContent(event.toolName, event.partialResult)
      : undefined;
  sendUpdate(sessionId, {
    sessionUpdate: "tool_call_update",
    toolCallId: event.toolCallId,
    status: "in_progress",
    content: content?.[0]?.type === "content" ? [content[0]] : content,
  });
}

function handleToolExecutionEnd(event: ToolExecEndEvent, sessionId: SessionId): void {
  const existing = getActiveToolCalls(sessionId).get(event.toolCallId);
  if (!existing) return;
  const result = event.result as Record<string, unknown> | undefined;
  const content = piToolResultToAcpContent(
    event.toolName,
    result?.content,
    result !== undefined && typeof result.details === "object" && result.details !== null
      ? (result.details as Record<string, unknown>)
      : undefined,
  );
  const update: ToolCallUpdate = {
    toolCallId: event.toolCallId,
    status: event.isError ? "failed" : "completed",
    content,
    rawOutput: event.result,
  };
  // Update our tracking
  existing.status = event.isError ? "failed" : "completed";
  existing.content = content;
  existing.rawOutput = event.result;
  sendUpdate(sessionId, {
    sessionUpdate: "tool_call_update",
    ...update,
  });
}

function handleTurnEnd(event: TurnEndEvent, sessionId: SessionId): void {
  for (const tr of event.toolResults) {
    getActiveToolCalls(sessionId).delete(tr.toolCallId);
  }
}

/** Handle a pi SDK event and translate it to ACP notifications. */
export function handlePiEvent(event: AgentSessionEvent, sessionId: SessionId): void {
  switch (event.type) {
    case "agent_start": {
      const turnId = generateTurnId();
      setTurnId(sessionId, turnId);
      break;
    }
    case "agent_end": {
      handleAgentEnd(sessionId);
      break;
    }
    case "message_update": {
      handleMessageUpdate(event, sessionId);
      break;
    }
    case "message_start": {
      handleMessageStart(event, sessionId);
      break;
    }
    case "message_end": {
      handleMessageEnd(event, sessionId);
      break;
    }
    case "tool_execution_start": {
      handleToolExecutionStart(event, sessionId);
      break;
    }
    case "tool_execution_update": {
      handleToolExecutionUpdate(event, sessionId);
      break;
    }
    case "tool_execution_end": {
      handleToolExecutionEnd(event, sessionId);
      break;
    }
    case "turn_start": {
      if (getTurnId(sessionId) === undefined) {
        setTurnId(sessionId, generateTurnId());
      }
      break;
    }
    case "turn_end": {
      handleTurnEnd(event, sessionId);
      break;
    }
    case "compaction_start":
      break;
    case "compaction_end":
      break;
    default:
      break;
  }
}

/** Clean up tracking data for a session. */
export function cleanupSession(sessionId: string): void {
  activeToolCalls.delete(sessionId);
}
