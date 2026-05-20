// initialize handler — protocol handshake and capability negotiation.
import { throwAcpError } from "../../utils/error-codes.js";
import { setClientCapabilities } from "../client-state.js";
import {
  AGENT_NAME,
  AGENT_TITLE,
  AGENT_VERSION,
  ACP_ERROR_CODES,
  PROTOCOL_VERSION,
  type AgentCapabilities,
  type InitializeRequest,
  type InitializeResponse,
} from "../types.js";

export { getClientCapabilities } from "../client-state.js";

/**
 * Handle the `initialize` ACP method — protocol handshake and capability negotiation.
 * Validates the client's protocol version, stores capabilities, and returns agent info.
 * @param params - The `InitializeRequest` with `protocolVersion` and `clientCapabilities`
 * @returns Agent capabilities, info, and supported auth methods
 * @throws {Error} ACP error -32602 if `params` is missing or `protocolVersion` is invalid
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleInitialize(
  params: Record<string, unknown> | undefined,
): Promise<InitializeResponse> {
  if (!params) {
    throwAcpError(ACP_ERROR_CODES.INVALID_PARAMS, "Invalid params: missing protocolVersion");
  }

  const req = params as unknown as InitializeRequest;

  // Validate protocol version
  if (typeof req.protocolVersion !== "number") {
    throwAcpError(ACP_ERROR_CODES.INVALID_PARAMS, "Invalid params: protocolVersion must be a number");
  }

  // Store client capabilities for later use
  setClientCapabilities(req.clientCapabilities);

  // Build agent capabilities — we support all standard baseline + optional features
  const agentCapabilities: AgentCapabilities = {
    loadSession: true,
    sessionCapabilities: {
      close: {},
      list: {},
      resume: {},
      fork: {},
    },
    promptCapabilities: {
      image: true,
      audio: false, // pi doesn't support audio in prompts
      embeddedContext: true,
    },
    mcpCapabilities: {
      http: false, // MCP not implemented
      sse: false,
    },
  };

  return {
    protocolVersion: PROTOCOL_VERSION,
    agentCapabilities,
    agentInfo: {
      name: AGENT_NAME,
      title: AGENT_TITLE,
      version: AGENT_VERSION,
    },
    authMethods: [], // pi doesn't require auth
  };
}
