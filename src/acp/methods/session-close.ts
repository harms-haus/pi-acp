// session/close handler — closes an active session.
import { cleanupSession } from "../../pi/event-translator.js";
import { removeSession, setSessionCancelling, requireSession } from "../../pi/session-registry.js";
import type { CloseSessionRequest, CloseSessionResponse } from "../types.js";

import { cleanupConfigOptions } from "./session-set-config.js";

/**
 * Handle the `session/close` ACP method — closes and cleans up an active session.
 * Aborts any ongoing work, cleans up tracking data, and removes the session.
 * @param params - The `CloseSessionRequest` with `sessionId`
 * @returns An empty `CloseSessionResponse`
 * @throws {Error} ACP error -32602 if `sessionId` is missing
 * @throws {Error} ACP error -32002 if the session is not found
 */
export async function handleSessionClose(
  params: Record<string, unknown> | undefined,
): Promise<CloseSessionResponse> {
  const { entry, req } = requireSession<CloseSessionRequest>(params, ["sessionId"]);

  // Cancel any ongoing work
  setSessionCancelling(req.sessionId, true);
  try {
    await entry.session.abort();
  } catch {
    // Ignore errors during abort
  }

  // Clean up tracking data
  cleanupSession(req.sessionId);
  cleanupConfigOptions(req.sessionId);

  // Remove the session
  removeSession(req.sessionId);

  return {};
}
