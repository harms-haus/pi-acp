# pi-acp: ACP Agent Transport for Pi

## Overview

`pi-acp` is a standalone Node.js program that wraps pi's SDK to expose a full ACP (Agent Client Protocol) compliant agent over JSON-RPC 2.0 on stdin/stdout.

It is **NOT a pi extension** — it is a standalone binary that uses `createAgentSession()` from `@earendil-works/pi-coding-agent` to create and manage pi sessions, translating ACP protocol messages to SDK calls and vice versa.

## Architecture

```
ACP Client (IDE, editor)
    │ stdin/stdout (JSON-RPC 2.0)
    ▼
┌─────────────────────────────────┐
│  pi-acp (Node.js)               │
│  ┌─────────────┐ ┌────────────┐ │
│  │ Stdio       │ │ ACP        │ │
│  │ Transport   │◄►│ Protocol   │ │
│  │ (JSONL)     │ │ Handler    │ │
│  └─────────────┘ └─────┬──────┘ │
│                        │        │
│  ┌─────────────────────┴──────┐ │
│  │ Session Registry           │ │
│  │ (ACP sessionId → SDK sess) │ │
│  └─────────────┬──────────────┘ │
│                │                │
│  ┌─────────────┴──────────────┐ │
│  │ Pi SDK (createAgentSession)│ │
│  │ + ACP Extension (loaded    │ │
│  │   via extensionFactories)  │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

## Module Structure

```
src/
├── index.ts                    # Entry point: stdio setup, protocol handler start
├── acp/
│   ├── types.ts               # All ACP protocol types (requests, responses, notifications)
│   ├── protocol.ts            # JSON-RPC 2.0 message router, request/response matching
│   └── methods/
│       ├── initialize.ts      # initialize handler
│       ├── authenticate.ts    # authenticate handler
│       ├── session-new.ts     # session/new handler
│       ├── session-load.ts    # session/load handler
│       ├── session-resume.ts  # session/resume handler
│       ├── session-close.ts   # session/close handler
│       ├── session-list.ts    # session/list handler
│       ├── session-prompt.ts  # session/prompt handler (THE CORE LOOP)
│       ├── session-cancel.ts  # session/cancel handler
│       ├── session-set-mode.ts    # session/set_mode handler
│       ├── session-set-config.ts  # session/set_config_option handler
│       ├── session-fork.ts    # session/fork handler (UNSTABLE)
│       ├── session-set-model.ts   # session/set_model handler (UNSTABLE)
│       ├── providers-list.ts  # providers/list handler (UNSTABLE)
│       ├── providers-set.ts   # providers/set handler (UNSTABLE)
│       ├── providers-disable.ts   # providers/disable handler (UNSTABLE)
│       ├── logout.ts          # logout handler (UNSTABLE)
│       ├── nes-start.ts       # nes/start handler (UNSTABLE)
│       ├── nes-suggest.ts     # nes/suggest handler (UNSTABLE)
│       └── nes-close.ts       # nes/close handler (UNSTABLE)
├── pi/
│   ├── session-registry.ts    # ACP sessionId → pi AgentSession mapping
│   ├── event-translator.ts    # Pi events → ACP session/update notifications
│   ├── sdk-factory.ts         # createAgentSession wrapper with ACP extension
│   └── acp-extension.ts       # Pi extension for permission delegation & tool hooks
├── transport/
│   └── stdio.ts               # Robust JSONL reader/writer for stdin/stdout
├── client-methods/
│   ├── request-permission.ts  # session/request_permission (agent→client)
│   ├── fs-read.ts             # fs/read_text_file (agent→client)
│   ├── fs-write.ts            # fs/write_text_file (agent→client)
│   └── terminal/
│       ├── create.ts          # terminal/create (agent→client)
│       ├── output.ts          # terminal/output (agent→client)
│       ├── wait-for-exit.ts   # terminal/wait_for_exit (agent→client)
│       ├── release.ts         # terminal/release (agent→client)
│       └── kill.ts            # terminal/kill (agent→client)
└── utils/
    ├── turn-id.ts             # Turn ID generation
    ├── content-translation.ts # Pi content blocks ↔ ACP content blocks
    └── error-codes.ts         # ACP/JSON-RPC error codes
```

## Implementation Plan

### Phase 1: Foundation (Types + Transport)
1. **ACP Types** (`acp/types.ts`) — Define all protocol types:
   - All request/response types
   - All notification types  
   - ContentBlock discriminated unions
   - ToolCall, ToolCallUpdate, ToolCallContent
   - Plan, PlanEntry types
   - SessionUpdate discriminated union (all 11 variants)
   - Enums: StopReason, ToolCallStatus, ToolKind, PlanEntryStatus, PlanEntryPriority, PermissionOptionKind, RequestPermissionOutcome
   - Capability trees: AgentCapabilities, ClientCapabilities
   - SessionModeState, SessionConfigOption, SessionInfo
   - McpServer types (stdio/http/sse)
   - Implementation info, AuthMethod types
   - Usage, Cost, ModelInfo types (UNSTABLE)
   - All types include `_meta?: Record<string, unknown> | null`

2. **Transport** (`transport/stdio.ts`) — Robust JSONL over stdin/stdout:
   - Custom JSONL reader (NOT readline — per pi's RPC docs warning about Unicode separators)
   - JSON-RPC 2.0 message parsing
   - Response writing with proper LF delimiters
   - Graceful shutdown on stdin close

3. **Protocol Router** (`acp/protocol.ts`) — JSON-RPC 2.0 message handling:
   - Request ID tracking for pending requests
   - Response routing (match incoming responses to pending client method calls)
   - Notification dispatch
   - Error response generation
   - Pending request map for client-side methods (permission requests, fs/terminal calls)

### Phase 2: Session Management
4. **Session Registry** (`pi/session-registry.ts`) — ACP session ID management:
   - Map ACP session IDs to pi AgentSession instances
   - Session lifecycle tracking (active, closed, loading)
   - Session metadata (cwd, mcpServers, createdAt)
   - Session listing with pagination

5. **SDK Factory** (`pi/sdk-factory.ts`) — AgentSession creation:
   - Wrap `createAgentSession()` with ACP-specific configuration
   - Load the ACP extension via `extensionFactories`
   - Configure auth, model registry, session manager
   - Set up event subscription pipeline

### Phase 3: ACP Extension (loaded by SDK)
6. **ACP Extension** (`pi/acp-extension.ts`) — Pi extension for ACP behaviors:
   - Permission request delegation: Hook `tool_call` events, send ACP permission requests to client, await response
   - Tool execution monitoring: Track tool calls for ACP session/update notifications
   - No UI (headless mode) — all user interaction goes through ACP protocol

### Phase 4: Event Translation
7. **Event Translator** (`pi/event-translator.ts`) — Pi events → ACP session/update:
   - `message_update` (text_delta) → `agent_message_chunk`
   - `message_update` (thinking_delta) → `agent_thought_chunk`
   - `message_end` (assistant) → finalize message
   - `message_start` (user) → `user_message_chunk`
   - `tool_execution_start` → `tool_call` (status: pending)
   - `tool_execution_update` → `tool_call_update` (status: in_progress)
   - `tool_execution_end` → `tool_call_update` (status: completed/failed)
   - `agent_start` / `agent_end` → turn lifecycle tracking
   - Turn ID generation and consistency
   - Plan updates (if available)
   - Usage updates

### Phase 5: Agent Methods (client→agent)
8. **initialize** — Protocol handshake, capability negotiation
9. **authenticate** — Auth method selection (pi doesn't require auth, so this is a no-op)
10. **session/new** — Create new pi session, return ACP sessionId
11. **session/load** — Load existing pi session, replay history via session/update
12. **session/resume** — Resume session without history replay
13. **session/close** — Close session, abort ongoing work
14. **session/list** — List sessions with pagination
15. **session/prompt** — THE CORE LOOP: trigger pi agent, stream updates, return stopReason
16. **session/cancel** — Abort ongoing prompt turn
17. **session/set_mode** — Set session mode
18. **session/set_config_option** — Set config option
19. **session/fork** (UNSTABLE) — Fork session
20. **session/set_model** (UNSTABLE) — Set model for session
21. **providers/list, providers/set, providers/disable** (UNSTABLE) — Provider management
22. **logout** (UNSTABLE) — Logout
23. **nes/start, nes/suggest, nes/close** (UNSTABLE) — Next Edit Suggestions

### Phase 6: Client Methods (agent→client)
24. **session/request_permission** — Request user permission before tool execution
25. **fs/read_text_file** — Read file via client (if client supports it)
26. **fs/write_text_file** — Write file via client (if client supports it)
27. **terminal/create** — Create terminal via client
28. **terminal/output** — Get terminal output
29. **terminal/wait_for_exit** — Wait for terminal to exit
30. **terminal/release** — Release terminal resources
31. **terminal/kill** — Kill terminal command

### Phase 7: UNSABLE/Document Methods (optional, capability-gated)
32. **document/didOpen, didChange, didClose, didSave, didFocus** — NES document events
33. **nes/accept, nes/reject** — NES suggestion feedback
34. **elicitation/create, elicitation/complete** — Structured user input

## Key Design Decisions

1. **Standalone, not extension**: Owns stdin/stdout completely. No protocol conflicts.
2. **SDK-based**: Uses `createAgentSession()` for full programmatic control.
3. **Internal extension**: Loaded via `extensionFactories` for permission delegation.
4. **No custom ACP events**: All events use standard ACP types. Custom data goes in `_meta`.
5. **No custom event shapes**: All notifications follow the exact ACP `SessionUpdate` discriminated union.
6. **Protocol version**: `1` (current stable).
7. **All types include `_meta`**: For extensibility as per ACP spec.

## Content Translation Strategy

Pi's internal content formats map to ACP as follows:

| Pi Format | ACP Format |
|-----------|------------|
| String text | `{ type: "text", text: "..." }` |
| `TextContent` | `{ type: "text", text: "..." }` |
| `ImageContent` | `{ type: "image", data: "...", mimeType: "..." }` |
| Tool result (string) | `ToolCallContent { type: "content", content: { type: "text", text: "..." } }` |
| Tool result (with details) | `ToolCallContent { type: "content", ... }` + rawOutput in `_meta` |
| File edits (edit tool) | `ToolCallContent { type: "diff", path: "...", newText: "...", oldText: "..." }` |

## Permission Flow

1. Pi's agent calls a tool (via SDK)
2. ACP extension's `tool_call` handler intercepts
3. If tool needs permission (based on policy/config), extension:
   a. Creates `RequestPermissionRequest` with tool call details and permission options
   b. Sends as JSON-RPC request to stdout
   c. Awaits response from ACP client
   d. If allowed, lets tool execute; if denied, returns `{ block: true }`
4. If client doesn't support permissions (no capability), auto-approve

## Cancellation Flow

1. ACP client sends `session/cancel` notification
2. Protocol handler finds the active `session/prompt` for that session
3. Calls `session.abort()` on the pi AgentSession
4. Event translator sends final `session/update` notifications
5. Protocol handler resolves the pending `session/prompt` request with `stopReason: "cancelled"`

## Error Mapping

| Pi Error | ACP JSON-RPC Error Code |
|----------|------------------------|
| Parse error (invalid JSON) | -32700 |
| Invalid request (missing fields) | -32600 |
| Method not found | -32601 |
| Invalid params | -32602 |
| Internal error | -32603 |
| Auth required | -32000 |
| Resource not found | -32002 |
| Unknown error | -32042 |

## Build & Package

- No TypeScript compilation needed (jiti-style runtime loading)
- Shebang line for direct execution: `#!/usr/bin/env node`
- ES modules with `.ts` extension
- `package.json` with `bin` entry for `pi-acp`
