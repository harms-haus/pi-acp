// Session registry — maps ACP session IDs to pi AgentSession instances.
import type { AgentSession } from "@earendil-works/pi-coding-agent";

import type { SessionInfo } from "../acp/types.js";

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
