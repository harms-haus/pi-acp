// Client-side terminal method implementations — execute locally when the ACP client
// does NOT advertise the corresponding capabilities.
import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";

import { getClientCapabilities } from "../acp/client-state.js";
import { sendClientRequest } from "../acp/protocol.js";
import {
  ACP_ERROR_CODES,
  type CreateTerminalRequest,
  type CreateTerminalResponse,
  type TerminalOutputResponse,
  type WaitForTerminalExitResponse,
  type ReleaseTerminalResponse,
  type KillTerminalResponse,
} from "../acp/types.js";
import { getSession } from "../pi/session-registry.js";
import { throwAcpError } from "../utils/error-codes.js";
import { isPathWithinRoot } from "../utils/path-validation.js";

interface TerminalWaiter {
  resolve: (status: { exitCode?: number; signal?: string }) => void;
  reject: (err: Error) => void;
}

interface ActiveTerminal {
  proc: ReturnType<typeof spawn>;
  output: string;
  outputCharLimit: number;
  exited: boolean;
  exitCode: number | null;
  exitSignal: string | null;
  waitingForExit: TerminalWaiter[];
}

const activeTerminals = new Map<string, ActiveTerminal>();
const DEFAULT_OUTPUT_CHAR_LIMIT = 1024 * 1024; // 1MB default

/** Validate and retrieve a terminal by terminalId from params. */
function requireTerminal(params: unknown): { terminalId: string; terminal: ActiveTerminal } {
  const req = params as { terminalId?: string };
  if (req.terminalId === undefined || req.terminalId === "") {
    throwAcpError(ACP_ERROR_CODES.INVALID_PARAMS, "Invalid params: terminalId is required");
  }
  const terminal = activeTerminals.get(req.terminalId);
  if (!terminal) {
    throwAcpError(ACP_ERROR_CODES.RESOURCE_NOT_FOUND, `Terminal not found: ${req.terminalId}`);
  }
  return { terminalId: req.terminalId, terminal };
}

/**
 * Handle the `terminal/create` client method — spawns a new terminal process.
 * Delegates to the ACP client if it advertises `terminal` capability;
 * otherwise spawns locally with cwd validation and output truncation.
 * @param params - The `CreateTerminalRequest` with `command`, optional `args`, `cwd`, `env`, and `outputByteLimit`
 * @returns The new `terminalId`
 * @throws {Error} ACP error -32602 if `command` is missing
 * @throws {Error} ACP error -32002 if `cwd` is outside the session scope
 */
export async function handleTerminalCreate(
  params: Record<string, unknown> | undefined,
): Promise<CreateTerminalResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.terminal === true) {
    return sendClientRequest("terminal/create", params ?? {}) as Promise<CreateTerminalResponse>;
  }
  const req = params as unknown as CreateTerminalRequest;
  if (!req.command) {
    throwAcpError(ACP_ERROR_CODES.INVALID_PARAMS, "Invalid params: command is required");
  }
  // Validate cwd is within session scope
  if (typeof req.cwd === "string") {
    const session = getSession(req.sessionId);
    const sessionCwd = session?.cwd ?? process.cwd();
    if (!isPathWithinRoot(req.cwd, sessionCwd)) {
      throwAcpError(
        ACP_ERROR_CODES.RESOURCE_NOT_FOUND,
        `Terminal cwd outside session scope: ${req.cwd}`,
      );
    }
  }
  const terminalId = `term_${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}`;
  const env = req.env
    ? {
        ...process.env,
        ...Object.fromEntries(
          req.env.map((e: { name: string; value: string }) => [e.name, e.value]),
        ),
      }
    : undefined;
  const args = req.args ?? [];
  // No shell:true — use direct exec to prevent command injection
  const spawnOpts: SpawnOptionsWithoutStdio = {
    cwd: req.cwd ?? undefined,
    env,
    shell: false,
  };
  const proc = spawn(req.command, args, spawnOpts);
  const outputCharLimit = req.outputByteLimit ?? DEFAULT_OUTPUT_CHAR_LIMIT;
  const terminal: ActiveTerminal = {
    proc,
    output: "",
    outputCharLimit,
    exited: false,
    exitCode: null,
    exitSignal: null,
    waitingForExit: [],
  };
  proc.stdout.on("data", (chunk: Buffer) => {
    terminal.output += chunk.toString();
    _truncateTerminalOutput(terminal);
  });
  proc.stderr.on("data", (chunk: Buffer) => {
    terminal.output += chunk.toString();
    _truncateTerminalOutput(terminal);
  });
  proc.on("exit", (code, signal) => {
    terminal.exited = true;
    terminal.exitCode = code ?? null;
    terminal.exitSignal = signal;
    for (const waiter of terminal.waitingForExit) {
      waiter.resolve({ exitCode: code ?? undefined, signal: signal ?? undefined });
    }
    terminal.waitingForExit = [];
    // Auto-cleanup after exit
    proc.removeAllListeners();
    activeTerminals.delete(terminalId);
  });
  proc.on("error", (err) => {
    terminal.exited = true;
    terminal.exitCode = 1;
    terminal.output += `\nError: ${err.message}`;
    for (const waiter of terminal.waitingForExit) {
      waiter.reject(new Error(err.message));
    }
    terminal.waitingForExit = [];
    // Cleanup after error — mirrors the exit handler
    proc.removeAllListeners();
    activeTerminals.delete(terminalId);
  });
  activeTerminals.set(terminalId, terminal);
  return { terminalId };
}

function _truncateTerminalOutput(terminal: ActiveTerminal): void {
  if (terminal.output.length > terminal.outputCharLimit) {
    terminal.output = terminal.output.slice(-terminal.outputCharLimit);
  }
}

/**
 * Handle the `terminal/output` client method — returns accumulated terminal output.
 * @param params - Parameters with `terminalId`
 * @returns The terminal `output`, optional `exitStatus`, and `truncated` flag
 * @throws {Error} ACP error -32602 if `terminalId` is missing
 * @throws {Error} ACP error -32002 if the terminal is not found
 */
export async function handleTerminalOutput(
  params: Record<string, unknown> | undefined,
): Promise<TerminalOutputResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.terminal === true) {
    return sendClientRequest("terminal/output", params ?? {}) as Promise<TerminalOutputResponse>;
  }
  const { terminal } = requireTerminal(params);
  return {
    output: terminal.output,
    exitStatus: terminal.exited
      ? { exitCode: terminal.exitCode, signal: terminal.exitSignal }
      : undefined,
    truncated: terminal.output.length >= terminal.outputCharLimit,
  };
}

/**
 * Handle the `terminal/wait_for_exit` client method — waits for a terminal process to exit.
 * Resolves immediately if the process has already exited.
 * @param params - Parameters with `terminalId`
 * @returns The `exitCode` and optional `signal`
 * @throws {Error} ACP error -32602 if `terminalId` is missing
 * @throws {Error} ACP error -32002 if the terminal is not found
 */
export async function handleTerminalWaitForExit(
  params: Record<string, unknown> | undefined,
): Promise<WaitForTerminalExitResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.terminal === true) {
    return sendClientRequest(
      "terminal/wait_for_exit",
      params ?? {},
    ) as Promise<WaitForTerminalExitResponse>;
  }
  const { terminal } = requireTerminal(params);
  if (terminal.exited) {
    return { exitCode: terminal.exitCode ?? undefined, signal: terminal.exitSignal ?? undefined };
  }
  return new Promise((resolve, reject) => {
    terminal.waitingForExit.push({ resolve, reject });
  });
}

/**
 * Handle the `terminal/release` client method — releases a terminal, killing it if still running.
 * Removes the terminal from the active set.
 * @param params - Parameters with `terminalId`
 * @returns An empty `ReleaseTerminalResponse`
 * @throws {Error} ACP error -32602 if `terminalId` is missing
 * @throws {Error} ACP error -32002 if the terminal is not found
 */
export async function handleTerminalRelease(
  params: Record<string, unknown> | undefined,
): Promise<ReleaseTerminalResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.terminal === true) {
    return sendClientRequest("terminal/release", params ?? {}) as Promise<ReleaseTerminalResponse>;
  }
  const { terminalId, terminal } = requireTerminal(params);
  if (!terminal.exited) {
    terminal.proc.kill("SIGTERM");
  }
  activeTerminals.delete(terminalId);
  return {};
}

/**
 * Handle the `terminal/kill` client method — kills a terminal process and removes it.
 * @param params - Parameters with `terminalId`
 * @returns An empty `KillTerminalResponse`
 * @throws {Error} ACP error -32602 if `terminalId` is missing
 * @throws {Error} ACP error -32002 if the terminal is not found
 */
export async function handleTerminalKill(
  params: Record<string, unknown> | undefined,
): Promise<KillTerminalResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.terminal === true) {
    return sendClientRequest("terminal/kill", params ?? {}) as Promise<KillTerminalResponse>;
  }
  const { terminalId, terminal } = requireTerminal(params);
  if (!terminal.exited) {
    terminal.proc.kill("SIGTERM");
  }
  activeTerminals.delete(terminalId);
  return {};
}
