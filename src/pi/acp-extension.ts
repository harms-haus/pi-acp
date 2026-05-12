// ACP Extension — loaded into pi AgentSessions to delegate permissions to the ACP client.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { sendClientRequest } from "../acp/protocol.js";
import type {
  ToolCallUpdate,
  PermissionOption,
  RequestPermissionOutcome,
} from "../acp/types.js";
import { toolNameToKind, kindToTitle } from "../utils/content-translation.js";

// Permission cache: toolCallId → pending promise
const pendingPermissions = new Map<string, {
  resolve: (outcome: RequestPermissionOutcome) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

/**
 * Check if a tool call needs permission before execution.
 * Called by the protocol handler when the ACP client responds.
 */
export function resolvePermission(toolCallId: string, outcome: RequestPermissionOutcome): void {
  const pending = pendingPermissions.get(toolCallId);
  if (pending) {
    clearTimeout(pending.timer);
    pending.resolve(outcome);
    pendingPermissions.delete(toolCallId);
  }
}

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

/**
 * Request permission from the ACP client for a tool call.
 * This is called by the protocol layer, not by the extension directly,
 * because it needs access to the JSON-RPC transport.
 */
export async function requestPermissionFromClient(
  sessionId: string,
  toolCallId: string,
  toolName: string,
  input: unknown,
): Promise<RequestPermissionOutcome> {
  const kind = toolNameToKind(toolName);
  const toolCall: ToolCallUpdate = {
    toolCallId,
    title: kindToTitle(kind, input),
    kind,
    status: "pending",
    rawInput: input,
  };

  const options: PermissionOption[] = [
    { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
    { optionId: "allow_always", name: "Allow always", kind: "allow_always" },
    { optionId: "reject_once", name: "Reject once", kind: "reject_once" },
    { optionId: "reject_always", name: "Reject always", kind: "reject_always" },
  ];

  return new Promise<RequestPermissionOutcome>((resolve, reject) => {
    const timer = setTimeout(() => {
      const pending = pendingPermissions.get(toolCallId);
      if (pending) {
        pending.reject(new Error("Permission request timed out"));
        pendingPermissions.delete(toolCallId);
      }
    }, 30000);

    pendingPermissions.set(toolCallId, {
      resolve: (outcome) => { clearTimeout(timer); resolve(outcome); },
      reject: (err: unknown) => { clearTimeout(timer); reject(err instanceof Error ? err : new Error(String(err))); },
      timer,
    });

    // Send the permission request to the ACP client
    sendClientRequest("session/request_permission", {
      sessionId,
      toolCall,
      options,
    }).catch((err: unknown) => {
      const pending = pendingPermissions.get(toolCallId);
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(err instanceof Error ? err : new Error(String(err)));
        pendingPermissions.delete(toolCallId);
      }
    });
  });
}
