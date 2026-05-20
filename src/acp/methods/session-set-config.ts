// session/set_config_option handler — sets a session config option.
import { requireSession } from "../../pi/session-registry.js";
import type {
  SetSessionConfigOptionRequest,
  SetSessionConfigOptionResponse,
  SessionConfigOption,
} from "../types.js";

// Store config options per session
const configOptions = new Map<string, SessionConfigOption[]>();

/**
 * Handle the `session/set_config_option` ACP method — sets a config option on a session.
 * Initializes default config options on first call per session and updates the requested option.
 * @param params - The `SetSessionConfigOptionRequest` with `sessionId`, `configId`, and `value`
 * @returns The updated list of `SessionConfigOption` objects
 * @throws {Error} ACP error -32602 if `sessionId`, `configId`, or `value` is missing
 * @throws {Error} ACP error -32002 if the session is not found
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleSessionSetConfigOption(
  params: Record<string, unknown> | undefined,
): Promise<SetSessionConfigOptionResponse> {
  const { req } = requireSession<SetSessionConfigOptionRequest>(params, [
    "sessionId",
    "configId",
    "value",
  ]);

  // Get or create config options for this session
  let opts = configOptions.get(req.sessionId);
  if (!opts) {
    // Initialize with default config options
    opts = [
      {
        type: "select",
        id: "thought_level",
        name: "Thinking Level",
        category: "thought_level",
        currentValue: "medium",
        options: [
          { value: "off", name: "Off" },
          { value: "minimal", name: "Minimal" },
          { value: "low", name: "Low" },
          { value: "medium", name: "Medium" },
          { value: "high", name: "High" },
          { value: "xhigh", name: "Extra High" },
        ],
      },
    ];
    configOptions.set(req.sessionId, opts);
  }

  // Update the requested config option
  const opt = opts.find((o) => o.id === req.configId);
  if (opt) {
    // Use type narrowing based on the discriminated union
    if (opt.type === "select" && typeof req.value === "string") {
      // Narrow to SessionConfigSelect by checking type field
      const selectOpt = opt;
      selectOpt.currentValue = req.value;
    } else if (opt.type === "boolean") {
      // Narrow to SessionConfigBoolean by checking type field
      const booleanOpt = opt;
      booleanOpt.currentValue = req.value as unknown as boolean;
    }
  }

  return { configOptions: opts };
}

/** Clean up config options for a closed session to prevent memory leaks. */
export function cleanupConfigOptions(sessionId: string): void {
  configOptions.delete(sessionId);
}
