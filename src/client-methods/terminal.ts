// Client-side terminal method implementations — execute locally when the ACP client
// does NOT advertise the corresponding capabilities.
import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";

import { getClientCapabilities } from "../acp/methods/initialize.js";
import { sendClientRequest } from "../acp/protocol.js";
import type {
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
} from "../acp/types.js";
import { getSession } from "../pi/session-registry.js";
import { throwAcpError } from "../utils/error-codes.js";

interface TerminalWaiter {
  resolve: (status: { exitCode?: number; signal?: string }) => void;
  reject: (err: Error) => void;
}

interface ActiveTerminal {
  proc: ReturnType<typeof spawn>;
  output: string;
  outputByteLimit: number;
  exited: boolean;
  exitCode: number | null;
  exitSignal: string | null;
  waitingForExit: TerminalWaiter[];
}

const activeTerminals = new Map<string, ActiveTerminal>();
const DEFAULT_OUTPUT_BYTE_LIMIT = 1024 * 1024; // 1MB default

export async function handleTerminalCreate(
  params: Record<string, unknown> | undefined,
): Promise<CreateTerminalResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.terminal === true) {
    return sendClientRequest("terminal/create", params ?? {}) as Promise<CreateTerminalResponse>;
  }
  const req = params as unknown as CreateTerminalRequest;
  if (!req.command) {
    throwAcpError(-32602, "Invalid params: command is required");
  }
  // Validate cwd is within session scope
  if (typeof req.cwd === "string") {
    const session = getSession(req.sessionId);
    const sessionCwd = session?.cwd ?? process.cwd();
    const { isPathWithinRoot } = await import("../utils/path-validation.js");
    if (!isPathWithinRoot(req.cwd, sessionCwd)) {
      throwAcpError(-32002, `Terminal cwd outside session scope: ${req.cwd}`);
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
  const outputByteLimit = req.outputByteLimit ?? DEFAULT_OUTPUT_BYTE_LIMIT;
  const terminal: ActiveTerminal = {
    proc,
    output: "",
    outputByteLimit,
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
  });
  proc.on("error", (err) => {
    terminal.exited = true;
    terminal.exitCode = 1;
    terminal.output += `\nError: ${err.message}`;
    for (const waiter of terminal.waitingForExit) {
      waiter.reject(new Error(err.message));
    }
    terminal.waitingForExit = [];
  });
  activeTerminals.set(terminalId, terminal);
  return { terminalId };
}

function _truncateTerminalOutput(terminal: ActiveTerminal): void {
  if (terminal.output.length > terminal.outputByteLimit) {
    terminal.output = terminal.output.slice(-terminal.outputByteLimit);
  }
}

export async function handleTerminalOutput(
  params: Record<string, unknown> | undefined,
): Promise<TerminalOutputResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.terminal === true) {
    return sendClientRequest("terminal/output", params ?? {}) as Promise<TerminalOutputResponse>;
  }
  const req = params as unknown as TerminalOutputRequest;
  if (!req.terminalId) {
    throwAcpError(-32602, "Invalid params: terminalId is required");
  }
  const terminal = activeTerminals.get(req.terminalId);
  if (!terminal) {
    throwAcpError(-32002, `Terminal not found: ${req.terminalId}`);
  }
  return {
    output: terminal.output,
    exitStatus: terminal.exited
      ? { exitCode: terminal.exitCode, signal: terminal.exitSignal }
      : undefined,
    truncated: terminal.output.length >= terminal.outputByteLimit,
  };
}

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
  const req = params as unknown as WaitForTerminalExitRequest;
  if (!req.terminalId) {
    throwAcpError(-32602, "Invalid params: terminalId is required");
  }
  const terminal = activeTerminals.get(req.terminalId);
  if (!terminal) {
    throwAcpError(-32002, `Terminal not found: ${req.terminalId}`);
  }
  if (terminal.exited) {
    return { exitCode: terminal.exitCode ?? undefined, signal: terminal.exitSignal ?? undefined };
  }
  return new Promise((resolve, reject) => {
    terminal.waitingForExit.push({ resolve, reject });
  });
}

export async function handleTerminalRelease(
  params: Record<string, unknown> | undefined,
): Promise<ReleaseTerminalResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.terminal === true) {
    return sendClientRequest("terminal/release", params ?? {}) as Promise<ReleaseTerminalResponse>;
  }
  const req = params as unknown as ReleaseTerminalRequest;
  if (!req.terminalId) {
    throwAcpError(-32602, "Invalid params: terminalId is required");
  }
  const terminal = activeTerminals.get(req.terminalId);
  if (!terminal) {
    throwAcpError(-32002, `Terminal not found: ${req.terminalId}`);
  }
  if (!terminal.exited) {
    terminal.proc.kill("SIGTERM");
  }
  activeTerminals.delete(req.terminalId);
  return {};
}

export async function handleTerminalKill(
  params: Record<string, unknown> | undefined,
): Promise<KillTerminalResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.terminal === true) {
    return sendClientRequest("terminal/kill", params ?? {}) as Promise<KillTerminalResponse>;
  }
  const req = params as unknown as KillTerminalRequest;
  if (!req.terminalId) {
    throwAcpError(-32602, "Invalid params: terminalId is required");
  }
  const terminal = activeTerminals.get(req.terminalId);
  if (!terminal) {
    throwAcpError(-32002, `Terminal not found: ${req.terminalId}`);
  }
  if (!terminal.exited) {
    terminal.proc.kill("SIGTERM");
  }
  return {};
}
