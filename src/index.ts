#!/usr/bin/env node
// pi-acp — ACP (Agent Client Protocol) agent transport for pi.
// Runs as a standalone Node.js process speaking JSON-RPC 2.0 over stdin/stdout.

// ─── Agent Method Handlers ───────────────────────────────────────────────────
import {
  handleInitialize,
  handleAuthenticate,
  handleSessionNew,
  handleSessionLoad,
  handleSessionResume,
  handleSessionClose,
  handleSessionList,
  handleSessionPrompt,
  handleSessionCancel,
  handleSessionSetMode,
  handleSessionSetConfigOption,
  handleSessionFork,
  handleSessionSetModel,
  handleProvidersList,
  handleProvidersSet,
  handleProvidersDisable,
  handleLogout,
  handleNesStart,
  handleNesSuggest,
  handleNesClose,
} from "./acp/methods/index.js";
import { processMessage, registerHandler } from "./acp/protocol.js";
import { AGENT_METHODS } from "./acp/types.js";
import {
  handleFsReadTextFile,
  handleFsWriteTextFile,
  handleTerminalCreate,
  handleTerminalOutput,
  handleTerminalWaitForExit,
  handleTerminalRelease,
  handleTerminalKill,
} from "./client-methods/index.js";
import { attachStdioReader, onShutdown } from "./transport/index.js";

// ─── Register All Handlers ───────────────────────────────────────────────────
// Baseline agent methods
registerHandler(AGENT_METHODS.INITIALIZE, handleInitialize);
registerHandler(AGENT_METHODS.AUTHENTICATE, handleAuthenticate);
registerHandler(AGENT_METHODS.SESSION_NEW, handleSessionNew);
registerHandler(AGENT_METHODS.SESSION_PROMPT, handleSessionPrompt);

// Optional agent methods (capability-gated, but registered anyway)
registerHandler(AGENT_METHODS.SESSION_LOAD, handleSessionLoad);
registerHandler(AGENT_METHODS.SESSION_RESUME, handleSessionResume);
registerHandler(AGENT_METHODS.SESSION_CLOSE, handleSessionClose);
registerHandler(AGENT_METHODS.SESSION_LIST, handleSessionList);
registerHandler(AGENT_METHODS.SESSION_SET_MODE, handleSessionSetMode);
registerHandler(AGENT_METHODS.SESSION_SET_CONFIG_OPTION, handleSessionSetConfigOption);

// Cancel (notification — no response expected)
registerHandler(AGENT_METHODS.SESSION_CANCEL, handleSessionCancel);

// UNSTABLE methods
registerHandler(AGENT_METHODS.SESSION_FORK, handleSessionFork);
registerHandler(AGENT_METHODS.SESSION_SET_MODEL, handleSessionSetModel);
registerHandler(AGENT_METHODS.PROVIDERS_LIST, handleProvidersList);
registerHandler(AGENT_METHODS.PROVIDERS_SET, handleProvidersSet);
registerHandler(AGENT_METHODS.PROVIDERS_DISABLE, handleProvidersDisable);
registerHandler(AGENT_METHODS.LOGOUT, handleLogout);
registerHandler(AGENT_METHODS.NES_START, handleNesStart);
registerHandler(AGENT_METHODS.NES_SUGGEST, handleNesSuggest);
registerHandler(AGENT_METHODS.NES_CLOSE, handleNesClose);

// Client-side methods (fs/*, terminal/*) — implemented locally but also callable via delegation
registerHandler("fs/read_text_file", handleFsReadTextFile);
registerHandler("fs/write_text_file", handleFsWriteTextFile);
registerHandler("terminal/create", handleTerminalCreate);
registerHandler("terminal/output", handleTerminalOutput);
registerHandler("terminal/wait_for_exit", handleTerminalWaitForExit);
registerHandler("terminal/release", handleTerminalRelease);
registerHandler("terminal/kill", handleTerminalKill);

// ─── Start Protocol Handler ──────────────────────────────────────────────────
console.error("[pi-acp] Starting ACP agent on stdio...");
console.error("[pi-acp] Protocol version: 1");

// Set up graceful shutdown
let shuttingDown = false;
onShutdown(async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.error("[pi-acp] Shutting down...");
  // Dispose all active sessions
  const { getSessionIds, removeSession } = await import("./pi/index.js");
  for (const id of getSessionIds()) {
    try {
      removeSession(id);
    } catch {
      // ignore
    }
  }
});

// Attach the JSONL reader
const { dispose } = attachStdioReader((raw) => {
  void (async () => {
    try {
      await processMessage(raw);
    } catch (err) {
      console.error("[pi-acp] Error processing message:", err);
    }
  })();
});

// Handle stdin close
process.stdin.on("end", () => {
  console.error("[pi-acp] stdin closed, shutting down");
  dispose();
});

console.error("[pi-acp] Ready. Waiting for ACP messages...");
