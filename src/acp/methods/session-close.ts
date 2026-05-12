// session/close handler — closes an active session.
import { cleanupSession } from "../../pi/event-translator.js";
import { removeSession, getSession, setSessionCancelling } from "../../pi/session-registry.js";
import { throwAcpError } from "../../utils/error-codes.js";
import type { CloseSessionRequest, CloseSessionResponse } from "../types.js";

export async function handleSessionClose(
  params: Record<string, unknown> | undefined,
): Promise<CloseSessionResponse> {
  if (!params || typeof params !== "object" || !("sessionId" in params)) {
    throwAcpError(-32602, "Invalid params: sessionId is required");
  }

  const req = params as unknown as CloseSessionRequest;
  const entry = getSession(req.sessionId);

  if (!entry) {
    throwAcpError(-32002, `Session not found: ${req.sessionId}`);
  }

  // Cancel any ongoing work
  setSessionCancelling(req.sessionId, true);
  try {
    await entry.session.abort();
  } catch {
    // Ignore errors during abort
  }

  // Clean up tracking data
  cleanupSession(req.sessionId);

  // Remove the session
  removeSession(req.sessionId);

  return {};
}
