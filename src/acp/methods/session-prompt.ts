// session/prompt handler — THE CORE LOOP.
// Triggers the pi agent, streams updates, and returns stopReason.
import { handlePiEvent } from "../../pi/event-translator.js";
import { getSession, setPromptRequestId, setSessionCancelling, isSessionCancelling } from "../../pi/session-registry.js";
import { acpBlocksToPiContent } from "../../utils/content-translation.js";
import { throwAcpError } from "../../utils/error-codes.js";
import type { PromptRequest, PromptResponse, StopReason } from "../types.js";

export async function handleSessionPrompt(
  params: Record<string, unknown> | undefined,
  request: { id: number | string | null },
): Promise<PromptResponse> {
  if (!params || typeof params !== "object" || !("sessionId" in params) || !("prompt" in params)) {
    throwAcpError(-32602, "Invalid params: sessionId and prompt are required");
  }

  const req = params as unknown as PromptRequest;
  const entry = getSession(req.sessionId);
  if (!entry) {
    throwAcpError(-32002, `Session not found: ${req.sessionId}`);
  }

  const { session } = entry;

  // Store the request ID so we can resolve it on completion
  setPromptRequestId(req.sessionId, request.id);
  setSessionCancelling(req.sessionId, false);

  // Convert ACP content blocks to pi prompt format
  const piPrompt = acpBlocksToPiContent(req.prompt);

  // Subscribe to pi events and translate to ACP
  const unsubscribe = session.subscribe((event) => {
    handlePiEvent(event, req.sessionId);
  });

  try {
    // Start the prompt — this blocks until the agent completes
    // We intercept tool calls for permission checking via the ACP extension
    await session.prompt(typeof piPrompt === "string" ? piPrompt : JSON.stringify(piPrompt));

    // Determine stop reason from the session state
    const stopReason = determineStopReason(session.agent.state, req.sessionId);
    return { stopReason };
  } finally {
    unsubscribe();
    setPromptRequestId(req.sessionId, null);
    setSessionCancelling(req.sessionId, false);
  }
}

/**
 * Determine the stop reason based on the session agent state.
 * @param state - The session agent state
 * @param sessionId - The session ID for cancellation checking
 * @returns The stop reason
 */
function determineStopReason(
  state: { errorMessage?: string },
  sessionId: string,
): StopReason {
  const errorMessage = state.errorMessage;

  // Check for refusal
  if (errorMessage?.toLowerCase().includes("refusal") ?? false) {
    return "refusal";
  }

  // Check for max tokens
  if (errorMessage?.toLowerCase().includes("max_tokens") ?? false) {
    return "max_tokens";
  }

  // Check if cancelled
  if (isSessionCancelling(sessionId)) {
    return "cancelled";
  }

  // Check for max turns
  if (errorMessage?.toLowerCase().includes("max") ?? false) {
    return "max_turn_requests";
  }

  // Default: end_turn
  return "end_turn";
}
