// providers/* handlers (UNSTABLE) — list, set, disable
import { throwAcpError } from "../../utils/error-codes.js";
import {
  ACP_ERROR_CODES,
  type ListProvidersResponse,
  type SetProvidersResponse,
  type DisableProvidersResponse,
} from "../types.js";

/**
 * Handle the `providers/list` ACP method (UNSTABLE) — returns an empty providers list.
 * @param _params - The method parameters (ignored)
 * @returns An empty `ListProvidersResponse`
 */
export async function handleProvidersList(
  _params: Record<string, unknown> | undefined,
): Promise<ListProvidersResponse> {
  return { providers: [] };
}

/**
 * Handle the `providers/set` ACP method (UNSTABLE) — not yet implemented.
 * @param _params - The method parameters (ignored)
 * @returns Never returns — always throws
 * @throws {Error} ACP error -32601 (method not found)
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleProvidersSet(
  _params: Record<string, unknown> | undefined,
): Promise<SetProvidersResponse> {
  throwAcpError(ACP_ERROR_CODES.METHOD_NOT_FOUND, "Method not implemented (UNSTABLE): providers/set");
}

/**
 * Handle the `providers/disable` ACP method (UNSTABLE) — not yet implemented.
 * @param _params - The method parameters (ignored)
 * @returns Never returns — always throws
 * @throws {Error} ACP error -32601 (method not found)
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleProvidersDisable(
  _params: Record<string, unknown> | undefined,
): Promise<DisableProvidersResponse> {
  throwAcpError(ACP_ERROR_CODES.METHOD_NOT_FOUND, "Method not implemented (UNSTABLE): providers/disable");
}
