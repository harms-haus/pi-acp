// Turn ID generation — groups ACP session/update notifications belonging to the same LLM turn.
let _counter = 0;

/** Generate a unique turn ID. Call on agent_start. */
export function generateTurnId(): string {
  _counter++;
  return `turn-${String(Date.now())}-${String(_counter)}`;
}

/**
 * Extract or generate a turn ID for a message entry during session/load replay.
 * Uses the entry's id as the stable identifier.
 */
export function extractTurnIdFromMessage(entryId: string): string {
  return `replay-${entryId}`;
}
