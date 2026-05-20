// Parameter validation helper — reduces boilerplate in ACP method handlers.
import { throwAcpError } from "./error-codes.js";

/**
 * Validate that params is a non-null object containing all required keys.
 * Throws ACP error -32602 (Invalid params) on failure.
 * Returns the params typed as T for convenient downstream use.
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
    throwAcpError(-32602, message);
  }
  const obj = params as Record<string, unknown>;
  for (const key of keys) {
    if (!(key in obj)) {
      throwAcpError(-32602, `Invalid params: missing '${key}'`);
    }
  }
  return params as T;
}
