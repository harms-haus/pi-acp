// nes/* handlers (UNSTABLE) — start, suggest, close
import { throwAcpError } from "../../utils/error-codes.js";
import { ACP_ERROR_CODES, type StartNesResponse, type SuggestNesResponse, type CloseNesResponse } from "../types.js";

/**
 * Handle the `nes/start` ACP method (UNSTABLE) — not yet implemented.
 * @param _params - The method parameters (ignored)
 * @returns Never returns — always throws
 * @throws {Error} ACP error -32601 (method not found)
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleNesStart(
  _params: Record<string, unknown> | undefined,
): Promise<StartNesResponse> {
  throwAcpError(ACP_ERROR_CODES.METHOD_NOT_FOUND, "Method not implemented (UNSTABLE): nes/start");
}

/**
 * Handle the `nes/suggest` ACP method (UNSTABLE) — not yet implemented.
 * @param _params - The method parameters (ignored)
 * @returns Never returns — always throws
 * @throws {Error} ACP error -32601 (method not found)
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleNesSuggest(
  _params: Record<string, unknown> | undefined,
): Promise<SuggestNesResponse> {
  throwAcpError(ACP_ERROR_CODES.METHOD_NOT_FOUND, "Method not implemented (UNSTABLE): nes/suggest");
}

/**
 * Handle the `nes/close` ACP method (UNSTABLE) — not yet implemented.
 * @param _params - The method parameters (ignored)
 * @returns Never returns — always throws
 * @throws {Error} ACP error -32601 (method not found)
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleNesClose(
  _params: Record<string, unknown> | undefined,
): Promise<CloseNesResponse> {
  throwAcpError(ACP_ERROR_CODES.METHOD_NOT_FOUND, "Method not implemented (UNSTABLE): nes/close");
}
