// initialize handler — protocol handshake and capability negotiation.
import { throwAcpError } from "../../utils/error-codes.js";
import { setClientCapabilities } from "../client-state.js";
import {
  AGENT_NAME,
  AGENT_TITLE,
  AGENT_VERSION,
  PROTOCOL_VERSION,
  type AgentCapabilities,
  type InitializeRequest,
  type InitializeResponse,
} from "../types.js";

export { getClientCapabilities } from "../client-state.js";

// eslint-disable-next-line @typescript-eslint/require-await
export async function handleInitialize(
  params: Record<string, unknown> | undefined,
): Promise<InitializeResponse> {
  if (!params) {
    throwAcpError(-32602, "Invalid params: missing protocolVersion");
  }

  const req = params as unknown as InitializeRequest;

  // Validate protocol version
  if (typeof req.protocolVersion !== "number") {
    throwAcpError(-32602, "Invalid params: protocolVersion must be a number");
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
