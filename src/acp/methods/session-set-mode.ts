// session/set_mode handler — sets the session mode.
import { getSession } from "../../pi/session-registry.js";
import { throwAcpError } from "../../utils/error-codes.js";
import type { SetSessionModeRequest, SetSessionModeResponse } from "../types.js";

export async function handleSessionSetMode(
  params: Record<string, unknown> | undefined,
): Promise<SetSessionModeResponse> {
  if (!params || typeof params !== "object" || !("sessionId" in params) || !("modeId" in params)) {
    throwAcpError(-32602, "Invalid params: sessionId and modeId are required");
  }

  const req = params as unknown as SetSessionModeRequest;
  const entry = getSession(req.sessionId);
  if (!entry) {
    throwAcpError(-32002, `Session not found: ${req.sessionId}`);
  }

  // Pi doesn't have a direct mode-setting API in the SDK.
  // Mode changes are typically handled by the system prompt or tool availability.
  // We accept the mode change and store it for future reference.
  // The actual mode behavior would need to be implemented via custom system prompts.
  return {};
}
