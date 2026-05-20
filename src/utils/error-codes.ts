// ACP / JSON-RPC error code helpers.
import { ACP_ERROR_CODES } from "../acp/types.js";

/**
 * Throw a JSON-RPC compatible error object.
 * This is caught by the protocol handler and converted to a proper error response.
 * @param code - JSON-RPC error code
 * @param message - Error message
 * @param data - Optional additional data
 * @throws Always throws an error object with code and message properties
 */
export function throwAcpError(code: number, message: string, data?: unknown): never {
  const error = new Error(message) as Error & { code: number; data?: unknown };
  error.code = code;
  error.data = data;
  throw error;
}

export { ACP_ERROR_CODES };
