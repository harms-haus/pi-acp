// session/new handler — creates a new pi session.
import { createAcpSession } from "../../pi/sdk-factory.js";
import { registerSession } from "../../pi/session-registry.js";
import { throwAcpError } from "../../utils/error-codes.js";
import { requireParams } from "../../utils/param-validation.js";
import type { NewSessionRequest, NewSessionResponse } from "../types.js";

export async function handleSessionNew(
  params: Record<string, unknown> | undefined,
): Promise<NewSessionResponse> {
  const req = requireParams<NewSessionRequest>(params, ["cwd"]);

  if (typeof req.cwd !== "string" || req.cwd.length === 0) {
    throwAcpError(-32602, "Invalid params: cwd must be a non-empty string");
  }

  // Create the pi session
  const { session } = await createAcpSession({
    cwd: req.cwd,
    mcpServers: req.mcpServers,
  });

  // Register it in the ACP session registry
  const acpSessionId = registerSession(session, req.cwd);

  return { sessionId: acpSessionId };
}
