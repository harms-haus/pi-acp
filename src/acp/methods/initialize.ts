// initialize handler — protocol handshake and capability negotiation.
import { throwAcpError } from "../../utils/error-codes.js";
import {
  AGENT_NAME,
  AGENT_TITLE,
  AGENT_VERSION,
  PROTOCOL_VERSION,
  type AgentCapabilities,
  type InitializeRequest,
  type InitializeResponse,
} from "../types.js";

let _clientCapabilities: InitializeRequest["clientCapabilities"] | null = null;

export function getClientCapabilities(): InitializeRequest["clientCapabilities"] | null {
  return _clientCapabilities;
}

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
  _clientCapabilities = req.clientCapabilities;

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
