// session/resume handler — resumes session without history replay.
import { requireSession } from "../../pi/session-registry.js";
import type { ResumeSessionRequest, ResumeSessionResponse } from "../types.js";

/**
 * Handle the `session/resume` ACP method — resumes a session without history replay.
 * The session must already be active in memory.
 * @param params - The `ResumeSessionRequest` with `sessionId`
 * @returns An empty `ResumeSessionResponse`
 * @throws {Error} ACP error -32602 if `sessionId` is missing
 * @throws {Error} ACP error -32002 if the session is not found
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleSessionResume(
  params: Record<string, unknown> | undefined,
): Promise<ResumeSessionResponse> {
  requireSession<ResumeSessionRequest>(params, ["sessionId"]);

  // Session is already active — just acknowledge
  // In a full implementation, we could reconnect to MCP servers here
  return {};
}
