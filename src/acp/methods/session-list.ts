// session/list handler — lists sessions with pagination.
import { SessionManager } from "@earendil-works/pi-coding-agent";

import { listSessions } from "../../pi/session-registry.js";
import type { ListSessionsRequest, ListSessionsResponse } from "../types.js";

const DEFAULT_PAGE_SIZE = 50;

/**
 * Handle the `session/list` ACP method — lists sessions with cursor-based pagination.
 * Merges active in-memory sessions with persisted `.jsonl` sessions from disk.
 * @param params - The `ListSessionsRequest` with optional `cwd` filter and `cursor`
 * @returns Paginated list of `SessionInfo` objects and an optional `nextCursor`
 */
export async function handleSessionList(
  params: Record<string, unknown> | undefined,
): Promise<ListSessionsResponse> {
  const req = (params ?? {}) as ListSessionsRequest;

  // List active in-memory sessions
  const activeSessions = listSessions(req.cwd ?? undefined);

  // Also list persisted sessions from the session directory
  const cwd = req.cwd ?? process.cwd();
  let persistedSessions: { sessionId: string; cwd: string; title?: string; updatedAt?: string }[] =
    [];

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

  // Simple cursor-based pagination
  const limit = DEFAULT_PAGE_SIZE;
  let cursor = 0;
  if (req.cursor !== null && req.cursor !== undefined) {
    const parsed = parseInt(req.cursor, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      cursor = parsed;
    }
  }
  const slice = all.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < all.length ? String(cursor + limit) : undefined;

  return { sessions: slice, nextCursor };
}
