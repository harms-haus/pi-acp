// ACP (Agent Client Protocol) Type Definitions
// Re-exports all types from @agentclientprotocol/sdk with compatibility shims.
// Protocol version 1 – all types follow the ACP spec exactly.
// Custom data MUST go in _meta fields only.

// Re-export everything from SDK — covers all types, PROTOCOL_VERSION, etc.
export * from "@agentclientprotocol/sdk";

// Explicit alias: SDK exports `Error` which conflicts with the global `Error`.
// Consumers should use `AcpError` to refer to the SDK's error type.
export type { Error as AcpError } from "@agentclientprotocol/sdk";

// ─── Local Type Definitions (not in SDK) ─────────────────────────────────────

// JSON-RPC 2.0 Envelope types (not exported by SDK, needed for transport layer)
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string | null;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: Record<string, unknown> | unknown[] | null;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  error: JsonRpcErrorObject;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown> | unknown[];
}

export type JsonRpcIncoming = JsonRpcRequest | JsonRpcNotification;
export type JsonRpcOutgoing = JsonRpcResponse | JsonRpcErrorResponse | JsonRpcNotification;

// ─── Compatibility Constants ─────────────────────────────────────────────────

// Pi agent metadata constants (not in SDK)
export const AGENT_NAME = "pi";
export const AGENT_TITLE = "pi coding agent";
export const AGENT_VERSION = "0.1.0";

/**
 * Compatibility shim: The SDK uses "agent_thought_chunk" but our event translator
 * was using "agent_thinking_chunk". This constant provides the SDK's canonical value.
 */
export const AGENT_THOUGHT_CHUNK_TYPE = "agent_thought_chunk" as const;

/**
 * Compatibility shim: The SDK's ToolKind does NOT include "create".
 * This mapping converts "create" → "other" when converting to SDK types.
 */
export function toSdkToolKind(kind: string): string {
  if (kind === "create") {
    return "other";
  }
  return kind;
}

/**
 * Compatibility shim: The SDK's AGENT_METHODS uses snake_case keys with snake_case values
 * (e.g., session_new: "session_new") while our code uses UPPERCASE keys with kebab-case values.
 * This mapping provides backward compatibility.
 *
 * Our local definition overrides the SDK's AGENT_METHODS.
 */
export const AGENT_METHODS = {
  INITIALIZE: "initialize",
  AUTHENTICATE: "authenticate",
  SESSION_NEW: "session/new",
  SESSION_LOAD: "session/load",
  SESSION_RESUME: "session/resume",
  SESSION_CLOSE: "session/close",
  SESSION_LIST: "session/list",
  SESSION_PROMPT: "session/prompt",
  SESSION_CANCEL: "session/cancel",
  SESSION_SET_MODE: "session/set_mode",
  SESSION_SET_CONFIG_OPTION: "session/set_config_option",
  SESSION_FORK: "session/fork",
  SESSION_SET_MODEL: "session/set_model",
  PROVIDERS_LIST: "providers/list",
  PROVIDERS_SET: "providers/set",
  PROVIDERS_DISABLE: "providers/disable",
  LOGOUT: "logout",
  NES_START: "nes/start",
  NES_SUGGEST: "nes/suggest",
  NES_CLOSE: "nes/close",
  DOCUMENT_DID_OPEN: "document/didOpen",
  DOCUMENT_DID_CHANGE: "document/didChange",
  DOCUMENT_DID_CLOSE: "document/didClose",
  DOCUMENT_DID_SAVE: "document/didSave",
  DOCUMENT_DID_FOCUS: "document/didFocus",
  NES_ACCEPT: "nes/accept",
  NES_REJECT: "nes/reject",
} as const;

/**
 * Our local CLIENT_METHODS overrides the SDK's CLIENT_METHODS with UPPER_CASE keys.
 */
export const CLIENT_METHODS = {
  SESSION_UPDATE: "session/update",
  SESSION_REQUEST_PERMISSION: "session/request_permission",
  FS_READ_TEXT_FILE: "fs/read_text_file",
  FS_WRITE_TEXT_FILE: "fs/write_text_file",
  TERMINAL_CREATE: "terminal/create",
  TERMINAL_OUTPUT: "terminal/output",
  TERMINAL_WAIT_FOR_EXIT: "terminal/wait_for_exit",
  TERMINAL_RELEASE: "terminal/release",
  TERMINAL_KILL: "terminal/kill",
  ELICITATION_CREATE: "elicitation/create",
  ELICITATION_COMPLETE: "elicitation/complete",
} as const;

/**
 * ACP Error codes - mirrors the SDK's RequestError static error codes for backward compatibility.
 * These match the JSON-RPC 2.0 error codes used by the SDK.
 */
export const ACP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  AUTH_REQUIRED: -32000,
  RESOURCE_NOT_FOUND: -32002,
  UNKNOWN_ERROR: -32042,
} as const;
