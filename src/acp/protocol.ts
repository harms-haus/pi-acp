// ACP Protocol handler — JSON-RPC 2.0 message router.
// Routes incoming client requests to method handlers and manages pending client-side requests.
import { writeResponse, writeError, writeNotification, writeOutgoing } from "../transport/stdio.js";

import {
  ACP_ERROR_CODES,
  type JsonRpcIncoming,
  type JsonRpcRequest,
  type JsonRpcNotification,
  type JsonRpcErrorObject,
} from "./types.js";

/**
 * Interface for errors with optional code and data properties.
 * Used for JSON-RPC error handling.
 */
interface ErrorWithCode extends Error {
  code?: number;
  data?: unknown;
}

/**
 * Interface for JSON-RPC response messages.
 * Used for parsing incoming responses from the client.
 */
interface JsonRpcResponseMessage {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: JsonRpcErrorObject;
}

// Pending client-side request resolvers (for session/request_permission, fs/*, terminal/*)
interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const CLIENT_REQUEST_TIMEOUT_MS = 60_000;

const pendingClientRequests = new Map<number | string, PendingRequest>();
let _nextRequestId = 1;

/** Generate a unique request ID for outgoing client requests. */
function nextRequestId(): number {
  return _nextRequestId++;
}

/**
 * Send a request to the ACP client and await the response.
 * Used for session/request_permission, fs/read_text_file, terminal/*, etc.
 */
export function sendClientRequest(
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const id = nextRequestId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingClientRequests.delete(id);
      reject(new Error(`Client request ${method} timed out`));
    }, CLIENT_REQUEST_TIMEOUT_MS);

    pendingClientRequests.set(id, {
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
      timer,
    });

    writeOutgoing({ jsonrpc: "2.0", id, method, params });
  });
}

/** Resolve a pending client response. */
export function handleClientResponse(id: number | string, result: unknown): void {
  const pending = pendingClientRequests.get(id);
  if (pending) {
    clearTimeout(pending.timer);
    pendingClientRequests.delete(id);
    pending.resolve(result);
  }
}

/** Reject a pending client response with an error. */
export function handleClientError(
  id: number | string,
  code: number,
  message: string,
  data?: unknown,
): void {
  const pending = pendingClientRequests.get(id);
  if (pending) {
    clearTimeout(pending.timer);
    pendingClientRequests.delete(id);
    const err = new Error(`Client error ${String(code)}: ${message}`) as ErrorWithCode;
    err.code = code;
    err.data = data;
    pending.reject(err);
  }
}

/** Method handler type. */
export type MethodHandler = (
  params: Record<string, unknown> | undefined,
  request: JsonRpcRequest,
) => Promise<unknown>;

// Registry of method handlers
const handlers = new Map<string, MethodHandler>();

/** Register a method handler. */
export function registerHandler(method: string, handler: MethodHandler): void {
  handlers.set(method, handler);
}

/** Parse a raw JSON-RPC string into a typed message, or return null on parse/validate error. */
function parseJsonRpc(raw: string): JsonRpcIncoming | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.jsonrpc !== "string" || parsed.jsonrpc !== "2.0") {
      writeError(null, ACP_ERROR_CODES.INVALID_REQUEST, "Invalid Request", { raw });
      return null;
    }
    return parsed as unknown as JsonRpcIncoming;
  } catch {
    writeError(null, ACP_ERROR_CODES.PARSE_ERROR, "Parse error", { raw });
    return null;
  }
}

/** Check if an incoming message is a response to one of our client requests and handle it. */
function tryHandleIncomingResponse(msg: JsonRpcIncoming): boolean {
  if (!("id" in msg) || "method" in msg) return false;

  if ("result" in msg) {
    const resp = msg as JsonRpcResponseMessage;
    handleClientResponse(resp.id, resp.result);
    return true;
  }

  if ("error" in msg) {
    const resp = msg as JsonRpcResponseMessage;
    const errObj = resp.error;
    handleClientError(resp.id, errObj?.code ?? -32603, errObj?.message ?? "Error", errObj?.data);
    return true;
  }

  return false;
}

/** Process an incoming JSON-RPC message. */
export async function processMessage(raw: string): Promise<void> {
  const msg = parseJsonRpc(raw);
  if (msg === null) return;

  // If it's a response to a client-side request we sent
  if (tryHandleIncomingResponse(msg)) return;

  // Must be a request or notification
  if (!("method" in msg)) {
    writeError(null, ACP_ERROR_CODES.INVALID_REQUEST, "Invalid Request");
    return;
  }

  // Handle notifications (no id)
  if (!("id" in msg)) {
    await handleNotification(msg);
    return;
  }

  // Handle requests
  await handleRequest(msg);
}

async function handleNotification(msg: JsonRpcNotification): Promise<void> {
  const handler = handlers.get(msg.method);
  if (!handler) {
    // Unknown notifications are silently ignored per ACP spec
    return;
  }

  try {
    await handler(msg.params as Record<string, unknown> | undefined, {
      jsonrpc: "2.0",
      id: null,
      method: msg.method,
      params: msg.params,
    });
  } catch (err) {
    // Notifications don't get error responses, but we log
    console.error(`Notification handler error for ${msg.method}:`, err);
  }
}

async function handleRequest(request: JsonRpcRequest): Promise<void> {
  const { id, method, params } = request;

  // Handle client response (not a method call)
  if (!method) {
    writeError(id, ACP_ERROR_CODES.INVALID_REQUEST, "Invalid Request");
    return;
  }

  const handler = handlers.get(method);
  if (!handler) {
    writeError(id, ACP_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
    return;
  }

  try {
    const result = await handler(params as Record<string, unknown> | undefined, request);
    writeResponse(id, result ?? {});
  } catch (err) {
    const error = err as ErrorWithCode;
    if (typeof error.code === "number") {
      writeError(id, error.code, error.message, error.data);
    } else {
      // Don't leak stack traces — log internally, send sanitized message
      console.error(`[pi-acp] Internal error in ${method}:`, err);
      writeError(id, ACP_ERROR_CODES.INTERNAL_ERROR, "Internal error");
    }
  }
}

// Re-export the write functions so method handlers can use them
export { writeResponse, writeError, writeNotification };
