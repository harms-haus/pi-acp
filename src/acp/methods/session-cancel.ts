// session/cancel handler — cancels ongoing prompt turn.
import { cancelAllPermissions } from "../../pi/acp-extension.js";
import { getSession, setSessionCancelling } from "../../pi/session-registry.js";
import type { CancelNotification } from "../types.js";

export async function handleSessionCancel(
  params: Record<string, unknown> | undefined,
): Promise<void> {
  if (!params || typeof params !== "object" || !("sessionId" in params)) {
    return; // Can't throw on notifications
  }

  const req = params as unknown as CancelNotification;
  const entry = getSession(req.sessionId);

  if (!entry) return;

  // Mark as cancelling
  setSessionCancelling(req.sessionId, true);

  // Cancel all pending permission requests with "cancelled" outcome
  cancelAllPermissions();

  // Abort the session
  try {
    await entry.session.abort();
  } catch {
    // Ignore errors during abort
  }
}
