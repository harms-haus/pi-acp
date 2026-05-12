# pi-acp

**ACP (Agent Client Protocol) agent transport for the pi coding agent.**

A standalone Node.js binary that wraps pi's SDK to expose a fully ACP-compliant agent over JSON-RPC 2.0 on stdin/stdout. Enables any ACP-compatible client (Zed, VS Code, etc.) to drive the pi coding agent.

## Installation

### As a pi extension

```bash
pi install git:github.com/harms-haus/pi-acp
```

### From source

```bash
git clone https://github.com/harms-haus/pi-acp.git
cd pi-acp
npm install
npm run build
```

## Usage

```bash
# Start the ACP agent on stdio
npm start

# Development mode with hot reload
npm run dev

# Build to dist/
npm run build
```

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
│  │ + ACP Extension            │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

## Project Structure

```
src/
├── index.ts                      # Entry point — stdio setup, handler registration
├── acp/
│   ├── index.ts                  # Barrel exports
│   ├── types.ts                  # ACP types re-exported from @agentclientprotocol/sdk
│   ├── protocol.ts               # JSON-RPC 2.0 message router
│   └── methods/                  # ACP agent-side method handlers
│       ├── initialize.ts
│       ├── authenticate.ts
│       ├── session-new.ts
│       ├── session-load.ts
│       ├── session-resume.ts
│       ├── session-close.ts
│       ├── session-list.ts
│       ├── session-prompt.ts
│       ├── session-cancel.ts
│       ├── session-set-mode.ts
│       ├── session-set-config.ts
│       ├── session-fork.ts       # UNSTABLE
│       ├── session-set-model.ts  # UNSTABLE
│       ├── providers.ts          # UNSTABLE
│       ├── logout.ts             # UNSTABLE
│       └── nes.ts                # UNSTABLE
├── pi/
│   ├── index.ts                  # Barrel exports
│   ├── session-registry.ts       # Maps ACP session IDs → pi AgentSession
│   ├── event-translator.ts       # pi SDK events → ACP session/update notifications
│   ├── sdk-factory.ts            # Creates pi AgentSession with ACP config
│   └── acp-extension.ts          # ACP extension factory for permission delegation
├── client-methods/
│   ├── index.ts                  # Barrel exports
│   ├── filesystem.ts             # fs/read_text_file, fs/write_text_file
│   └── terminal.ts               # terminal/* handlers
├── transport/
│   ├── index.ts                  # Barrel exports
│   └── stdio.ts                  # JSONL over stdin/stdout
├── utils/
│   ├── index.ts                  # Barrel exports
│   ├── content-translation.ts    # pi content ↔ ACP ContentBlock conversion
│   ├── error-codes.ts            # JSON-RPC error helpers
│   ├── path-validation.ts        # Path sanitization (prevents traversal)
│   └── turn-id.ts                # Turn ID generation for notification grouping
└── (config)
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.test.json
    ├── eslint.config.mjs
    └── vitest.config.ts
```

## Supported ACP Methods

### Baseline (always available)
| Method | Status |
|--------|--------|
| `initialize` | ✅ Implemented |
| `authenticate` | ✅ No-op (pi doesn't require auth) |
| `session/new` | ✅ Implemented |
| `session/prompt` | ✅ Implemented |
| `session/cancel` | ✅ Implemented |

### Optional (capability-gated)
| Method | Status |
|--------|--------|
| `session/load` | ✅ Implemented (with history replay) |
| `session/resume` | ✅ Implemented |
| `session/close` | ✅ Implemented |
| `session/list` | ✅ Implemented (with pagination) |
| `session/set_mode` | ✅ Implemented |
| `session/set_config_option` | ✅ Implemented |

### Client-side methods (local fallback)
| Method | Status |
|--------|--------|
| `fs/read_text_file` | ✅ Implemented (with path validation) |
| `fs/write_text_file` | ✅ Implemented |
| `terminal/create` | ✅ Implemented |
| `terminal/output` | ✅ Implemented |
| `terminal/wait_for_exit` | ✅ Implemented |
| `terminal/release` | ✅ Implemented |
| `terminal/kill` | ✅ Implemented |

### UNSTABLE
| Method | Status |
|--------|--------|
| `session/fork` | ⚠️ Stub (not implemented) |
| `session/set_model` | ⚠️ Stub (not implemented) |
| `providers/list` | ✅ Returns empty list |
| `providers/set` | ⚠️ Stub (not implemented) |
| `providers/disable` | ⚠️ Stub (not implemented) |
| `logout` | ⚠️ Stub (not implemented) |
| `nes/*` | ⚠️ Stubs (not implemented) |

## Development

```bash
# Install dependencies
npm install

# Run all checks (lint + type-check + tests)
npm run check

# Lint
npm run lint
npm run lint:fix

# Type check
npx tsc --noEmit

# Tests
npm test
npm run test:watch
npm run test:coverage
```

## License

MIT
