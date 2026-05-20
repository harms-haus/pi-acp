// Turn ID generation — groups ACP session/update notifications belonging to the same LLM turn.
let _counter = 0;

/** Generate a unique turn ID. Call on agent_start. */
export function generateTurnId(): string {
  _counter++;
  return `turn-${String(Date.now())}-${String(_counter)}`;
}
