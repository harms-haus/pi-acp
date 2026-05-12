// SDK Factory — creates pi AgentSessions with ACP-specific configuration.
import {
  createAgentSession,
  AuthStorage,
  ModelRegistry,
  SessionManager,
  DefaultResourceLoader,
  getAgentDir,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";

import { acpExtensionFactory } from "./acp-extension.js";

export interface CreateAcpSessionOptions {
  cwd: string;
  mcpServers?: {
    name: string;
    command?: string;
    args?: string[];
    env?: { name: string; value: string }[];
    type?: "stdio" | "http" | "sse";
    url?: string;
    headers?: { name: string; value: string }[];
  }[];
}

/**
 * Create a pi AgentSession configured for ACP use.
 * The session includes the ACP extension for permission delegation.
 */
export async function createAcpSession(
  options: CreateAcpSessionOptions,
): Promise<{ session: AgentSession; sessionId: string }> {
  const { cwd } = options;

  // Set up auth and model registry
  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  // Resource loader with ACP extension
  const agentDir = getAgentDir();
  const loader = new DefaultResourceLoader({
    cwd,
    agentDir,
    extensionFactories: [acpExtensionFactory],
  });
  await loader.reload();

  // Create in-memory session manager (ACP manages its own session lifecycle)
  const sessionManager = SessionManager.inMemory();

  const result = await createAgentSession({
    cwd,
    agentDir,
    authStorage,
    modelRegistry,
    resourceLoader: loader,
    sessionManager,
    // Use default tools (read, bash, edit, write) — no need to specify
  });

  return {
    session: result.session,
    sessionId: result.session.sessionId,
  };
}
