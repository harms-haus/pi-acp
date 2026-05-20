// ACP (Agent Client Protocol) Type Definitions
// Re-exports all types from @agentclientprotocol/sdk with compatibility shims.
// Protocol version 1 – all types follow the ACP spec exactly.
// Custom data MUST go in _meta fields only.

// Import all types from SDK first (before using them in local type definitions)
import {
  // Core types
  type Implementation,
  type ProtocolVersion,
  type Role,
  type SessionId,
  type ModelId,
  type ToolCallId,
  type SessionModeId,
  type SessionConfigId,
  type SessionConfigValueId,
  type SessionConfigGroupId,
  type PermissionOptionId,
  type RequestId,

  // Content types
  type Annotations,
  type TextContent,
  type ImageContent,
  type AudioContent,
  type ResourceLink,
  type TextResourceContents,
  type BlobResourceContents,
  type EmbeddedResource,
  type ContentBlock,
  type Content,
  type ContentChunk,

  // Tool call types
  type ToolCall,
  type ToolCallUpdate,
  type ToolCallContent,
  type ToolCallLocation,
  type ToolCallStatus,
  type ToolKind,

  // Plan types
  type Plan,
  type PlanEntry,
  type PlanEntryStatus,
  type PlanEntryPriority,

  // Session mode types
  type SessionMode,
  type SessionModeState,
  type CurrentModeUpdate,

  // Session config types
  type SessionConfigOption,
  type SessionConfigSelect,
  type SessionConfigBoolean,
  type SessionConfigSelectOption,
  type SessionConfigSelectGroup,
  type SessionConfigSelectOptions,
  type ConfigOptionUpdate,
  type SessionConfigOptionCategory,

  // Session info types
  type SessionInfo,
  type SessionInfoUpdate,

  // MCP server types
  type McpServer,
  type McpServerStdio,
  type McpServerHttp,
  type McpServerSse,
  type HttpHeader,
  type EnvVariable,

  // Permission types
  type PermissionOption,
  type PermissionOptionKind,
  type RequestPermissionOutcome,
  type SelectedPermissionOutcome,

  // Terminal types
  type TerminalExitStatus,
  type Terminal,

  // Auth method types
  type AuthMethod,
  type AuthMethodAgent,
  type AuthMethodEnvVar,
  type AuthMethodTerminal,
  type AuthEnvVar,

  // Usage & Models
  type Usage,
  type UsageUpdate,
  type Cost,
  type ModelInfo,
  type SessionModelState,

  // Provider types
  type ProviderInfo,
  type ProviderCurrentConfig,
  type LlmProtocol,

  // NES types
  type NesCapabilities,
  type NesContextCapabilities,
  type NesEventCapabilities,
  type NesJumpCapabilities,
  type NesRenameCapabilities,
  type NesSearchAndReplaceCapabilities,
  type NesDocumentEventCapabilities,
  type NesOpenFilesCapabilities,
  type NesRecentFilesCapabilities,
  type NesRelatedSnippetsCapabilities,
  type NesUserActionsCapabilities,
  type NesEditHistoryCapabilities,
  type NesDiagnosticsCapabilities,

  // Capabilities
  type AgentCapabilities,
  type ClientCapabilities,
  type SessionCapabilities,
  type SessionCloseCapabilities,
  type SessionListCapabilities,
  type SessionResumeCapabilities,
  type SessionForkCapabilities,
  type SessionAdditionalDirectoriesCapabilities,
  type PromptCapabilities,
  type McpCapabilities,
  type AgentAuthCapabilities,
  type LogoutCapabilities,
  type ProvidersCapabilities,
  type FileSystemCapabilities,
  type AuthCapabilities,
  type ElicitationCapabilities,
  type ElicitationFormCapabilities,
  type ElicitationUrlCapabilities,
  type ClientNesCapabilities,

  // Session update types
  type SessionUpdate,
  type SessionNotification,

  // Available commands
  type AvailableCommand,
  type AvailableCommandInput,
  type AvailableCommandsUpdate,

  // Request/Response types
  type InitializeRequest,
  type InitializeResponse,
  type AuthenticateRequest,
  type AuthenticateResponse,
  type NewSessionRequest,
  type NewSessionResponse,
  type LoadSessionRequest,
  type LoadSessionResponse,
  type ResumeSessionRequest,
  type ResumeSessionResponse,
  type CloseSessionRequest,
  type CloseSessionResponse,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type PromptRequest,
  type PromptResponse,
  type CancelNotification,
  type SetSessionModeRequest,
  type SetSessionModeResponse,
  type SetSessionConfigOptionRequest,
  type SetSessionConfigOptionResponse,
  type ForkSessionRequest,
  type ForkSessionResponse,
  type SetSessionModelRequest,
  type SetSessionModelResponse,
  type ListProvidersRequest,
  type ListProvidersResponse,
  type SetProvidersRequest,
  type SetProvidersResponse,
  type DisableProvidersRequest,
  type DisableProvidersResponse,
  type LogoutRequest,
  type LogoutResponse,
  type StartNesRequest,
  type StartNesResponse,
  type SuggestNesRequest,
  type SuggestNesResponse,
  type CloseNesRequest,
  type CloseNesResponse,
  type DidOpenDocumentNotification,
  type DidChangeDocumentNotification,
  type DidCloseDocumentNotification,
  type DidSaveDocumentNotification,
  type DidFocusDocumentNotification,
  type AcceptNesNotification,
  type RejectNesNotification,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
  type CreateTerminalRequest,
  type CreateTerminalResponse,
  type TerminalOutputRequest,
  type TerminalOutputResponse,
  type WaitForTerminalExitRequest,
  type WaitForTerminalExitResponse,
  type ReleaseTerminalRequest,
  type ReleaseTerminalResponse,
  type KillTerminalRequest,
  type KillTerminalResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type CreateElicitationRequest,
  type CreateElicitationResponse,
  type CompleteElicitationNotification,

  // Stop reason
  type StopReason,

  // Position encoding
  type PositionEncodingKind,

  // Error types
  type Error as AcpError,
  type ErrorCode,

  // Values
  PROTOCOL_VERSION,
  RequestError,
  AGENT_METHODS as SDK_AGENT_METHODS,
  CLIENT_METHODS as SDK_CLIENT_METHODS,
} from "@agentclientprotocol/sdk";

// Now re-export everything for consumers of this module
export type {
  Implementation,
  ProtocolVersion,
  Role,
  SessionId,
  ModelId,
  ToolCallId,
  SessionModeId,
  SessionConfigId,
  SessionConfigValueId,
  SessionConfigGroupId,
  PermissionOptionId,
  RequestId,
  Annotations,
  TextContent,
  ImageContent,
  AudioContent,
  ResourceLink,
  TextResourceContents,
  BlobResourceContents,
  EmbeddedResource,
  ContentBlock,
  Content,
  ContentChunk,
  ToolCall,
  ToolCallUpdate,
  ToolCallContent,
  ToolCallLocation,
  ToolCallStatus,
  ToolKind,
  Plan,
  PlanEntry,
  PlanEntryStatus,
  PlanEntryPriority,
  SessionMode,
  SessionModeState,
  CurrentModeUpdate,
  SessionConfigOption,
  SessionConfigSelect,
  SessionConfigBoolean,
  SessionConfigSelectOption,
  SessionConfigSelectGroup,
  SessionConfigSelectOptions,
  ConfigOptionUpdate,
  SessionConfigOptionCategory,
  SessionInfo,
  SessionInfoUpdate,
  McpServer,
  McpServerStdio,
  McpServerHttp,
  McpServerSse,
  HttpHeader,
  EnvVariable,
  PermissionOption,
  PermissionOptionKind,
  RequestPermissionOutcome,
  SelectedPermissionOutcome,
  TerminalExitStatus,
  Terminal,
  AuthMethod,
  AuthMethodAgent,
  AuthMethodEnvVar,
  AuthMethodTerminal,
  AuthEnvVar,
  Usage,
  UsageUpdate,
  Cost,
  ModelInfo,
  SessionModelState,
  ProviderInfo,
  ProviderCurrentConfig,
  LlmProtocol,
  NesCapabilities,
  NesContextCapabilities,
  NesEventCapabilities,
  NesJumpCapabilities,
  NesRenameCapabilities,
  NesSearchAndReplaceCapabilities,
  NesDocumentEventCapabilities,
  NesOpenFilesCapabilities,
  NesRecentFilesCapabilities,
  NesRelatedSnippetsCapabilities,
  NesUserActionsCapabilities,
  NesEditHistoryCapabilities,
  NesDiagnosticsCapabilities,
  AgentCapabilities,
  ClientCapabilities,
  SessionCapabilities,
  SessionCloseCapabilities,
  SessionListCapabilities,
  SessionResumeCapabilities,
  SessionForkCapabilities,
  SessionAdditionalDirectoriesCapabilities,
  PromptCapabilities,
  McpCapabilities,
  AgentAuthCapabilities,
  LogoutCapabilities,
  ProvidersCapabilities,
  FileSystemCapabilities,
  AuthCapabilities,
  ElicitationCapabilities,
  ElicitationFormCapabilities,
  ElicitationUrlCapabilities,
  ClientNesCapabilities,
  SessionUpdate,
  SessionNotification,
  AvailableCommand,
  AvailableCommandInput,
  AvailableCommandsUpdate,
  InitializeRequest,
  InitializeResponse,
  AuthenticateRequest,
  AuthenticateResponse,
  NewSessionRequest,
  NewSessionResponse,
  LoadSessionRequest,
  LoadSessionResponse,
  ResumeSessionRequest,
  ResumeSessionResponse,
  CloseSessionRequest,
  CloseSessionResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  PromptRequest,
  PromptResponse,
  CancelNotification,
  SetSessionModeRequest,
  SetSessionModeResponse,
  SetSessionConfigOptionRequest,
  SetSessionConfigOptionResponse,
  ForkSessionRequest,
  ForkSessionResponse,
  SetSessionModelRequest,
  SetSessionModelResponse,
  ListProvidersRequest,
  ListProvidersResponse,
  SetProvidersRequest,
  SetProvidersResponse,
  DisableProvidersRequest,
  DisableProvidersResponse,
  LogoutRequest,
  LogoutResponse,
  StartNesRequest,
  StartNesResponse,
  SuggestNesRequest,
  SuggestNesResponse,
  CloseNesRequest,
  CloseNesResponse,
  DidOpenDocumentNotification,
  DidChangeDocumentNotification,
  DidCloseDocumentNotification,
  DidSaveDocumentNotification,
  DidFocusDocumentNotification,
  AcceptNesNotification,
  RejectNesNotification,
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalOutputRequest,
  TerminalOutputResponse,
  WaitForTerminalExitRequest,
  WaitForTerminalExitResponse,
  ReleaseTerminalRequest,
  ReleaseTerminalResponse,
  KillTerminalRequest,
  KillTerminalResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
  CreateElicitationRequest,
  CreateElicitationResponse,
  CompleteElicitationNotification,
  StopReason,
  PositionEncodingKind,
  AcpError,
  ErrorCode,
};

export { PROTOCOL_VERSION, RequestError, SDK_AGENT_METHODS, SDK_CLIENT_METHODS };

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
