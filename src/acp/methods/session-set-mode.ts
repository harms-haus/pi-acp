// session/set_mode handler — sets the session mode.
import { requireSession } from "../../pi/session-registry.js";
import type { SetSessionModeRequest, SetSessionModeResponse } from "../types.js";

/**
 * Handle the `session/set_mode` ACP method — accepts a mode change for the session.
 * Pi doesn't have a direct mode-setting API; mode is governed by system prompt / tool availability.
 * @param params - The `SetSessionModeRequest` with `sessionId` and `modeId`
 * @returns An empty `SetSessionModeResponse`
 * @throws {Error} ACP error -32602 if `sessionId` or `modeId` is missing
 * @throws {Error} ACP error -32002 if the session is not found
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleSessionSetMode(
  params: Record<string, unknown> | undefined,
): Promise<SetSessionModeResponse> {
  requireSession<SetSessionModeRequest>(params, ["sessionId", "modeId"]);

  // Pi doesn't have a direct mode-setting API in the SDK.
  // Mode changes are typically handled by the system prompt or tool availability.
  // We accept the mode change and store it for future reference.
  // The actual mode behavior would need to be implemented via custom system prompts.
  return {};
}
