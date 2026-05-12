// ACP stdio transport — robust JSONL over stdin/stdout.
// Does NOT use readline (splits on Unicode separators inside JSON).

import { StringDecoder } from "node:string_decoder";

import type { JsonRpcOutgoing } from "../acp/types.js";

let stdinClosed = false;
let stdinListener: ((chunk: Buffer) => void) | null = null;
let buffer = "";
const decoder = new StringDecoder("utf8");

/** Attach a JSONL reader to stdin. Returns dispose function. */
export function attachStdioReader(onMessage: (raw: string) => void): { dispose: () => void } {
  stdinListener = (chunk: Buffer) => {
    buffer += decoder.write(chunk);
    let nlIdx = buffer.indexOf("\n");
    while (nlIdx !== -1) {
      const raw = buffer.slice(0, nlIdx);
      buffer = buffer.slice(nlIdx + 1);
      const trimmed = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
      if (trimmed.length === 0) {
        nlIdx = buffer.indexOf("\n");
        continue; // skip blanks
      }
      onMessage(trimmed);
      nlIdx = buffer.indexOf("\n");
    }
  };
  // Note: "buffer" encoding is used to receive raw Buffer chunks from stdin.
  // TypeScript's Node.js types don't include "buffer" as a valid encoding,
  // but it's a valid Node.js runtime option for binary data handling.
  process.stdin.setEncoding("buffer" as unknown as BufferEncoding);
  process.stdin.on("data", stdinListener);
  process.stdin.on("end", () => {
    stdinClosed = true;
    const remaining = decoder.end();
    if (remaining) {
      const trimmed = remaining.endsWith("\r") ? remaining.slice(0, -1) : remaining;
      if (trimmed.length > 0) onMessage(trimmed);
    }
  });
  return { dispose };
}

function dispose(): void {
  if (stdinListener) {
    process.stdin.removeListener("data", stdinListener);
    stdinListener = null;
  }
}

/** Check if stdin has ended. */
export function isStdinClosed(): boolean {
  return stdinClosed;
}

/** Write a JSON object followed by LF to stdout. */
export function writeJson(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

/** Write a JSON-RPC success response. */
export function writeResponse(id: number | string | null, result: unknown): void {
  writeJson({ jsonrpc: "2.0" as const, id, result });
}

/** Write a JSON-RPC error response. */
export function writeError(id: number | string | null, code: number, message: string, data?: unknown): void {
  writeJson({
    jsonrpc: "2.0" as const,
    id,
    error: { code, message, data },
  });
}

/** Write a JSON-RPC notification. */
export function writeNotification(method: string, params?: unknown): void {
  if (params !== undefined) {
    writeJson({ jsonrpc: "2.0" as const, method, params });
  } else {
    writeJson({ jsonrpc: "2.0" as const, method });
  }
}

/** Write an arbitrary outgoing JSON-RPC message. */
export function writeOutgoing(msg: JsonRpcOutgoing): void {
  writeJson(msg);
}

/** Graceful shutdown handling. Deduplicates multiple signals. */
export function onShutdown(callback: () => Promise<void> | void): void {
  let shuttingDown = false;
  const run = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    void (async () => {
      try {
        await callback();
      } finally {
        process.exit(0);
      }
    })();
  };
  process.stdin.on("end", run);
  process.on("SIGTERM", run);
  process.on("SIGHUP", run);
  // SIGPIPE: node ignores by default, but handle just in case
  process.on("SIGPIPE", () => {
    // stdout broken — exit gracefully
    run();
  });
}
