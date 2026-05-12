// ACP Protocol handler — JSON-RPC 2.0 message router.
// Routes incoming client requests to method handlers and manages pending client-side requests.
import type {
  JsonRpcIncoming,
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcErrorObject,
} from "../acp/types.js";
import { writeResponse, writeError, writeNotification, writeOutgoing } from "../transport/stdio.js";

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
    }, 60000);

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
export function handleClientError(id: number | string, code: number, message: string, data?: unknown): void {
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

/** Process an incoming JSON-RPC message. */
export async function processMessage(raw: string): Promise<void> {
  let msg: JsonRpcIncoming;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.jsonrpc !== "string" || parsed.jsonrpc !== "2.0") {
      writeError(null, -32600, "Invalid Request", { raw });
      return;
    }
    msg = parsed as unknown as JsonRpcIncoming;
  } catch {
    writeError(null, -32700, "Parse error", { raw });
    return;
  }

  // If it's a response to a client-side request we sent
  if ("result" in msg && "id" in msg && !("method" in msg)) {
    const resp = msg as JsonRpcResponseMessage;
    handleClientResponse(resp.id, resp.result);
    return;
  }

  if ("error" in msg && "id" in msg && !("method" in msg)) {
    const resp = msg as JsonRpcResponseMessage;
    const errObj = resp.error;
    handleClientError(resp.id, errObj?.code ?? -32603, errObj?.message ?? "Error", errObj?.data);
    return;
  }

  // Must be a request or notification
  const incoming = msg;
  if (!("method" in incoming)) {
    writeError(null, -32600, "Invalid Request");
    return;
  }

  // Handle notifications (no id)
  if (!("id" in incoming)) {
    await handleNotification(incoming);
    return;
  }

  // Handle requests
  const request = incoming;
  await handleRequest(request);
}

async function handleNotification(msg: JsonRpcNotification): Promise<void> {
  const handler = handlers.get(msg.method);
  if (!handler) {
    // Unknown notifications are silently ignored per ACP spec
    return;
  }

  try {
    await handler(
      msg.params as Record<string, unknown> | undefined,
      { jsonrpc: "2.0", id: null, method: msg.method, params: msg.params },
    );
  } catch (err) {
    // Notifications don't get error responses, but we log
    console.error(`Notification handler error for ${msg.method}:`, err);
  }
}

async function handleRequest(request: JsonRpcRequest): Promise<void> {
  const { id, method, params } = request;

  // Handle client response (not a method call)
  if (!method) {
    writeError(id, -32600, "Invalid Request");
    return;
  }

  const handler = handlers.get(method);
  if (!handler) {
    writeError(id, -32601, `Method not found: ${method}`);
    return;
  }

  try {
    const result = await handler(
      params as Record<string, unknown> | undefined,
      request,
    );
    writeResponse(id, result ?? {});
  } catch (err) {
    const error = err as ErrorWithCode;
    if (typeof error.code === "number") {
      writeError(id, error.code, error.message, error.data);
    } else {
      // Don't leak stack traces — log internally, send sanitized message
      console.error(`[pi-acp] Internal error in ${method}:`, err);
      writeError(id, -32603, "Internal error");
    }
  }
}

/** Get all registered agent method names. */
export function getRegisteredMethods(): string[] {
  return Array.from(handlers.keys());
}

// Re-export the write functions so method handlers can use them
export { writeResponse, writeError, writeNotification };
