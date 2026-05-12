// session/list handler — lists sessions with pagination.
import { SessionManager } from "@earendil-works/pi-coding-agent";

import { listSessions } from "../../pi/session-registry.js";
import type { ListSessionsRequest, ListSessionsResponse } from "../types.js";

export async function handleSessionList(
  params: Record<string, unknown> | undefined,
): Promise<ListSessionsResponse> {
  const req = (params ?? {}) as ListSessionsRequest;

  // List active in-memory sessions
  const activeSessions = listSessions(req.cwd ?? undefined);

  // Also list persisted sessions from the session directory
  const cwd = req.cwd ?? process.cwd();
  let persistedSessions: { sessionId: string; cwd: string; title?: string; updatedAt?: string }[] = [];

  try {
    const smSessions = await SessionManager.list(cwd);
    persistedSessions = smSessions.map((s) => ({
      sessionId: s.path,
      cwd: s.cwd || cwd,
      title: s.name,
      updatedAt: s.modified.toISOString(),
    }));
  } catch {
    // Session directory may not exist — ignore
  }

  // Merge active + persisted (deduplicate by sessionId)
  const seen = new Set<string>();
  const all: ListSessionsResponse["sessions"] = [];

  for (const s of activeSessions) {
    if (!seen.has(s.sessionId)) {
      seen.add(s.sessionId);
      all.push(s);
    }
  }
  for (const s of persistedSessions) {
    if (!seen.has(s.sessionId)) {
      seen.add(s.sessionId);
      all.push(s);
    }
  }

  // Simple cursor-based pagination (return first 50 if no cursor)
  const limit = 50;
  const cursor = req.cursor !== null && req.cursor !== undefined ? parseInt(req.cursor, 10) : 0;
  const slice = all.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < all.length ? String(cursor + limit) : undefined;

  return { sessions: slice, nextCursor };
}
