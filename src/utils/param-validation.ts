// Parameter validation helper — reduces boilerplate in ACP method handlers.

import { ACP_ERROR_CODES } from "../acp/types.js";

import { throwAcpError } from "./error-codes.js";

/**
 * Validate that `params` is a non-null object containing all required keys.
 * Throws ACP error `-32602` (Invalid params) on failure.
 *
 * @typeParam T - The expected params type (used for the return type only)
 * @param params - The raw params from the JSON-RPC request
 * @param keys - Required property names that must exist on `params`
 * @param typeName - Optional type name for the error message (e.g. `"PromptRequest"`)
 * @returns The `params` value typed as `T`
 * @throws {Error} ACP error -32602 if `params` is not a non-null plain object or is missing a required key
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function requireParams<T>(params: unknown, keys: string[], typeName?: string): T {
  if (
    params === undefined ||
    params === null ||
    typeof params !== "object" ||
    Array.isArray(params)
  ) {
    const message =
      typeName !== undefined && typeName !== ""
        ? `Invalid params: expected ${typeName}`
        : "Invalid params: expected an object";
    throwAcpError(ACP_ERROR_CODES.INVALID_PARAMS, message);
  }
  const obj = params as Record<string, unknown>;
  for (const key of keys) {
    if (!(key in obj)) {
      throwAcpError(ACP_ERROR_CODES.INVALID_PARAMS, `Invalid params: missing '${key}'`);
    }
  }
  return params as T;
}
