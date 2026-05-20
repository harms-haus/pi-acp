// ACP / JSON-RPC error code helpers.
import { ACP_ERROR_CODES, type JsonRpcErrorResponse } from "../acp/types.js";

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

export function makeErrorResponse(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

export function makeParseError(data?: unknown): JsonRpcErrorResponse {
  return makeErrorResponse(null, ACP_ERROR_CODES.PARSE_ERROR, "Parse error", data);
}

export function makeInvalidRequestError(
  message = "Invalid Request",
  data?: unknown,
): JsonRpcErrorResponse {
  return makeErrorResponse(null, ACP_ERROR_CODES.INVALID_REQUEST, message, data);
}

export function makeMethodNotFoundError(method: string, data?: unknown): JsonRpcErrorResponse {
  return makeErrorResponse(
    null,
    ACP_ERROR_CODES.METHOD_NOT_FOUND,
    `Method not found: ${method}`,
    data,
  );
}

export function makeInvalidParamsError(
  message = "Invalid params",
  data?: unknown,
): JsonRpcErrorResponse {
  return makeErrorResponse(null, ACP_ERROR_CODES.INVALID_PARAMS, message, data);
}

export function makeInternalError(
  message = "Internal error",
  data?: unknown,
): JsonRpcErrorResponse {
  return makeErrorResponse(null, ACP_ERROR_CODES.INTERNAL_ERROR, message, data);
}

export function makeAuthRequiredError(data?: unknown): JsonRpcErrorResponse {
  return makeErrorResponse(null, ACP_ERROR_CODES.AUTH_REQUIRED, "Authentication required", data);
}

export function makeResourceNotFoundError(
  message = "Resource not found",
  data?: unknown,
): JsonRpcErrorResponse {
  return makeErrorResponse(null, ACP_ERROR_CODES.RESOURCE_NOT_FOUND, message, data);
}

export { ACP_ERROR_CODES };
