// session/resume handler — resumes session without history replay.
import { getSession } from "../../pi/session-registry.js";
import { throwAcpError } from "../../utils/error-codes.js";
import type { ResumeSessionRequest, ResumeSessionResponse } from "../types.js";

export async function handleSessionResume(
  params: Record<string, unknown> | undefined,
): Promise<ResumeSessionResponse> {
  if (!params || typeof params !== "object" || !("sessionId" in params)) {
    throwAcpError(-32602, "Invalid params: sessionId is required");
  }

  const req = params as unknown as ResumeSessionRequest;

  const existing = getSession(req.sessionId);
  if (!existing) {
    throwAcpError(-32002, `Session not found: ${req.sessionId}`);
  }

  // Session is already active — just acknowledge
  // In a full implementation, we could reconnect to MCP servers here
  return {};
}
