// session/set_model handler (UNSTABLE)
import { throwAcpError } from "../../utils/error-codes.js";
import { ACP_ERROR_CODES, type SetSessionModelResponse } from "../types.js";

/**
 * Handle the `session/set_model` ACP method (UNSTABLE) — not yet implemented.
 * @param _params - The method parameters (ignored)
 * @returns Never returns — always throws
 * @throws {Error} ACP error -32601 (method not found)
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleSessionSetModel(
  _params: Record<string, unknown> | undefined,
): Promise<SetSessionModelResponse> {
  throwAcpError(ACP_ERROR_CODES.METHOD_NOT_FOUND, "Method not implemented (UNSTABLE): session/set_model");
}
