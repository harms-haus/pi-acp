// ACP Extension — loaded into pi AgentSessions to delegate permissions to the ACP client.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import type { RequestPermissionOutcome } from "../acp/types.js";

// Permission cache: toolCallId → pending promise
const pendingPermissions = new Map<
  string,
  {
    resolve: (outcome: RequestPermissionOutcome) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

/** Cancel all pending permission requests (on session cancel). */
export function cancelAllPermissions(): void {
  for (const [id, pending] of pendingPermissions) {
    clearTimeout(pending.timer);
    pending.resolve({ outcome: "cancelled" });
    pendingPermissions.delete(id);
  }
}

/**
 * The ACP extension factory. Loaded into pi AgentSessions via extensionFactories.
 * Hooks tool_call events to delegate permission decisions to the ACP client.
 */
export function acpExtensionFactory(pi: ExtensionAPI): void {
  // The extension itself doesn't block tools — permission checking
  // is handled by the protocol layer in session-prompt.ts.
  // This extension exists as a hook point for future ACP-specific behaviors
  // like client-side tool delegation.

  pi.on("tool_call", async (_event, _ctx) => {
    // Permission checking is handled at the protocol level
    // (see src/acp/methods/session-prompt.ts)
  });
}
