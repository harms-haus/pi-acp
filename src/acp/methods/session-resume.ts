// session/resume handler — resumes session without history replay.
import { getSession } from "../../pi/session-registry.js";
import { throwAcpError } from "../../utils/error-codes.js";
import { requireParams } from "../../utils/param-validation.js";
import type { ResumeSessionRequest, ResumeSessionResponse } from "../types.js";

// eslint-disable-next-line @typescript-eslint/require-await
export async function handleSessionResume(
  params: Record<string, unknown> | undefined,
): Promise<ResumeSessionResponse> {
  const req = requireParams<ResumeSessionRequest>(params, ["sessionId"]);

  const existing = getSession(req.sessionId);
  if (!existing) {
    throwAcpError(-32002, `Session not found: ${req.sessionId}`);
  }

  // Session is already active — just acknowledge
  // In a full implementation, we could reconnect to MCP servers here
  return {};
}
