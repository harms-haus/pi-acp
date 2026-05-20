// session/load handler — loads an existing session and replays history.
import {
  SessionManager,
  AuthStorage,
  ModelRegistry,
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
} from "@earendil-works/pi-coding-agent";

import { acpExtensionFactory } from "../../pi/acp-extension.js";
import { registerSession, getSession } from "../../pi/session-registry.js";
import { writeNotification } from "../../transport/stdio.js";
import { piContentToAcpBlocks } from "../../utils/content-translation.js";
import { throwAcpError } from "../../utils/error-codes.js";
import { requireParams } from "../../utils/param-validation.js";
import { resolveAndValidatePath } from "../../utils/path-validation.js";
import { extractTurnIdFromMessage } from "../../utils/turn-id.js";
import { CLIENT_METHODS, type LoadSessionRequest, type LoadSessionResponse } from "../types.js";

/**
 * Interface for pi SDK session entries.
 * The SessionManager.getEntries() returns entries with this structure.
 */
interface PiMessageEntry {
  type: string;
  id: string;
  message: {
    role: string;
    content: unknown;
  };
  toolCalls?: (
    | {
        id?: string;
        name?: string;
        kind?: string;
      }
    | string
  )[];
}

export async function handleSessionLoad(
  params: Record<string, unknown> | undefined,
): Promise<LoadSessionResponse> {
  const req = requireParams<LoadSessionRequest>(params, ["sessionId", "cwd"]);

  // Map ACP sessionId to pi session file
  const existing = getSession(req.sessionId);
  if (existing) {
    // Session is already active — replay its history
    const sm = existing.session.sessionManager;
    replayHistory(sm, req.sessionId);
    return {};
  }

  // Check if the sessionId looks like a file path (for direct file loading)
  let sessionPath: string | undefined;
  if (req.sessionId.endsWith(".jsonl") || req.sessionId.includes("/")) {
    // Validate path is within cwd to prevent arbitrary file read
    sessionPath = resolveAndValidatePath(req.sessionId, req.cwd);
  }

  if (sessionPath === undefined) {
    throwAcpError(-32002, `Session not found: ${req.sessionId}`);
  }

  const sm = SessionManager.open(sessionPath);
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);
  const agentDir = getAgentDir();
  const loader = new DefaultResourceLoader({
    cwd: req.cwd,
    agentDir,
    extensionFactories: [acpExtensionFactory],
  });
  await loader.reload();

  const result = await createAgentSession({
    cwd: req.cwd,
    agentDir,
    authStorage,
    modelRegistry,
    resourceLoader: loader,
    sessionManager: sm,
  });

  const acpSessionId = registerSession(result.session, req.cwd);

  // Replay history via session/update notifications
  replayHistory(sm, acpSessionId);

  return {};
}

function replayHistory(sm: SessionManager, sessionId: string): void {
  const entries = sm.getEntries();

  for (const entry of entries) {
    if (entry.type !== "message") continue;

    void extractTurnIdFromMessage(entry.id);
    const msgEntry = entry as PiMessageEntry;
    const msg = msgEntry.message;
    const role = msg.role;
    const content = msg.content;

    if (role === "user") {
      // Replay user message as user_message_chunk
      const blocks = piContentToAcpBlocks(content);
      for (const block of blocks) {
        writeNotification(CLIENT_METHODS.SESSION_UPDATE, {
          sessionId,
          update: {
            sessionUpdate: "user_message_chunk",
            content: {
              content: block,
              messageId: entry.id,
            },
          },
        });
      }
    } else if (role === "assistant") {
      // Replay assistant message as agent_message_chunk
      const blocks = piContentToAcpBlocks(content);
      for (const block of blocks) {
        writeNotification(CLIENT_METHODS.SESSION_UPDATE, {
          sessionId,
          update: {
            sessionUpdate: "agent_message_chunk",
            content: {
              content: block,
              messageId: entry.id,
            },
          },
        });
      }

      // Replay tool calls from history
      if (msgEntry.toolCalls && Array.isArray(msgEntry.toolCalls)) {
        for (const tc of msgEntry.toolCalls) {
          const toolCall =
            typeof tc === "string"
              ? {
                  toolCallId: tc,
                  title: "Tool call",
                  status: "completed" as const,
                }
              : {
                  toolCallId: tc.id ?? tc,
                  title: tc.name ?? "Tool call",
                  kind: tc.kind,
                  status: "completed" as const,
                };
          writeNotification(CLIENT_METHODS.SESSION_UPDATE, {
            sessionId,
            update: {
              sessionUpdate: "tool_call",
              toolCall,
            },
          });
        }
      }
    }
  }
}
