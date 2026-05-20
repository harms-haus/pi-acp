// session/new handler — creates a new pi session.
import { createAcpSession } from "../../pi/sdk-factory.js";
import { registerSession } from "../../pi/session-registry.js";
import { throwAcpError } from "../../utils/error-codes.js";
import { requireParams } from "../../utils/param-validation.js";
import { ACP_ERROR_CODES, type NewSessionRequest, type NewSessionResponse } from "../types.js";

/**
 * Handle the `session/new` ACP method — creates a new pi agent session.
 * Creates an `AgentSession` via the SDK factory, registers it, and returns the session ID.
 * @param params - The `NewSessionRequest` with `cwd` and optional `mcpServers`
 * @returns The new `sessionId`
 * @throws {Error} ACP error -32602 if `cwd` is missing or not a non-empty string
 */
export async function handleSessionNew(
  params: Record<string, unknown> | undefined,
): Promise<NewSessionResponse> {
  const req = requireParams<NewSessionRequest>(params, ["cwd"]);

  if (typeof req.cwd !== "string" || req.cwd.length === 0) {
    throwAcpError(ACP_ERROR_CODES.INVALID_PARAMS, "Invalid params: cwd must be a non-empty string");
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
