// Session registry — maps ACP session IDs to pi AgentSession instances.
import type { AgentSession } from "@earendil-works/pi-coding-agent";

import { ACP_ERROR_CODES, type SessionInfo } from "../acp/types.js";
import { throwAcpError } from "../utils/error-codes.js";
import { requireParams } from "../utils/param-validation.js";

interface SessionEntry {
  session: AgentSession;
  cwd: string;
  createdAt: number;
  turnId?: string;
  promptRequestId?: number | string | null; // pending session/prompt request id
  cancelling: boolean;
}

let _nextId = 1;

function generateSessionId(): string {
  return `sess_${String(Date.now())}_${String(_nextId++)}`;
}

const sessions = new Map<string, SessionEntry>();

/** Register a new session. Returns the ACP session ID. */
export function registerSession(session: AgentSession, cwd: string): string {
  const id = generateSessionId();
  sessions.set(id, { session, cwd, createdAt: Date.now(), cancelling: false });
  return id;
}

/** Get a session by ACP ID. */
export function getSession(id: string): SessionEntry | undefined {
  return sessions.get(id);
}

/** Remove a session. Disposes the AgentSession. */
export function removeSession(id: string): void {
  const entry = sessions.get(id);
  if (entry) {
    entry.session.dispose();
    sessions.delete(id);
  }
}

/** List all active sessions as ACP SessionInfo[]. */
export function listSessions(cwd?: string): SessionInfo[] {
  const result: SessionInfo[] = [];
  for (const [id, entry] of sessions) {
    if (cwd !== undefined && entry.cwd !== cwd) continue;
    result.push({
      sessionId: id,
      cwd: entry.cwd,
      updatedAt: new Date(entry.createdAt).toISOString(),
    });
  }
  return result;
}

/** Set the current turn ID for a session. */
export function setTurnId(sessionId: string, turnId: string): void {
  const entry = sessions.get(sessionId);
  if (entry) entry.turnId = turnId;
}

/** Get the current turn ID for a session. */
export function getTurnId(sessionId: string): string | undefined {
  const entry = sessions.get(sessionId);
  return entry?.turnId;
}

/** Set the pending session/prompt request ID for cancellation tracking. */
export function setPromptRequestId(sessionId: string, requestId: number | string | null): void {
  const entry = sessions.get(sessionId);
  if (entry) entry.promptRequestId = requestId;
}

/** Get the pending prompt request ID. */
export function getPromptRequestId(sessionId: string): number | string | null | undefined {
  const entry = sessions.get(sessionId);
  return entry?.promptRequestId;
}

/** Mark a session as cancelling. */
export function setSessionCancelling(sessionId: string, value: boolean): void {
  const entry = sessions.get(sessionId);
  if (entry) entry.cancelling = value;
}

/** Check if a session is being cancelled. */
export function isSessionCancelling(sessionId: string): boolean {
  const entry = sessions.get(sessionId);
  return entry?.cancelling ?? false;
}

/** Get all session IDs. */
export function getSessionIds(): string[] {
  return Array.from(sessions.keys());
}

/**
 * Validate params and look up session in one call.
 *
 * Uses `requireParams` to ensure all `requiredKeys` are present and `sessionId` is among them,
 * then retrieves the session from the registry.
 *
 * @typeParam T - The expected params type (must include `sessionId`)
 * @param params - The raw params from the JSON-RPC request
 * @param requiredKeys - Required property names (must include `"sessionId"`)
 * @returns The session entry and typed params
 * @throws {Error} ACP error -32602 if a required key is missing
 * @throws {Error} ACP error -32002 if the session is not found
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function requireSession<T extends { sessionId: string }>(
  params: unknown,
  requiredKeys: string[],
): { entry: SessionEntry; req: T } {
  const req = requireParams<T>(params, requiredKeys);
  const entry = sessions.get(req.sessionId);
  if (!entry) {
    throwAcpError(ACP_ERROR_CODES.RESOURCE_NOT_FOUND, `Session not found: ${req.sessionId}`);
  }
  return { entry, req };
}
