// Client-side file system method implementations — execute locally when the ACP client
// does NOT advertise the corresponding capabilities.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname } from "node:path";

import { getClientCapabilities } from "../acp/client-state.js";
import { sendClientRequest } from "../acp/protocol.js";
import type {
  ReadTextFileRequest,
  ReadTextFileResponse,
  WriteTextFileRequest,
  WriteTextFileResponse,
} from "../acp/types.js";
import { getSession } from "../pi/session-registry.js";
import { throwAcpError } from "../utils/error-codes.js";
import { resolveAndValidatePath } from "../utils/path-validation.js";

export async function handleFsReadTextFile(
  params: Record<string, unknown> | undefined,
): Promise<ReadTextFileResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.fs?.readTextFile === true) {
    return sendClientRequest("fs/read_text_file", params ?? {}) as Promise<ReadTextFileResponse>;
  }
  const req = params as unknown as ReadTextFileRequest;
  if (!req.path) {
    throwAcpError(-32602, "Invalid params: path is required");
  }
  // Get session cwd for path validation
  const session = getSession(req.sessionId);
  const cwd = session?.cwd ?? process.cwd();
  // Validate and resolve path (prevents path traversal)
  const safePath = resolveAndValidatePath(req.path, cwd);
  // Also resolve realpath to catch symlinks escaping the sandbox
  const realPath = realpathSync(safePath);
  const realCwd = realpathSync(cwd);
  if (!realPath.startsWith(realCwd + "/") && realPath !== realCwd) {
    throwAcpError(-32002, `Path escapes session directory: ${req.path}`);
  }
  let content = readFileSync(realPath, "utf8");
  // Apply line/limit if specified
  if (typeof req.line === "number" || typeof req.limit === "number") {
    const lines = content.split("\n");
    const startLine = typeof req.line === "number" ? req.line - 1 : 0;
    const endLine = typeof req.limit === "number" ? startLine + req.limit : lines.length;
    content = lines.slice(startLine, endLine).join("\n");
  }
  return { content };
}

export async function handleFsWriteTextFile(
  params: Record<string, unknown> | undefined,
): Promise<WriteTextFileResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.fs?.writeTextFile === true) {
    return sendClientRequest("fs/write_text_file", params ?? {}) as Promise<WriteTextFileResponse>;
  }
  const req = params as unknown as WriteTextFileRequest;
  if (!req.path || typeof req.content !== "string") {
    throwAcpError(-32602, "Invalid params: path and content are required");
  }
  // Get session cwd for path validation
  const session = getSession(req.sessionId);
  const cwd = session?.cwd ?? process.cwd();
  // Validate and resolve path
  const safePath = resolveAndValidatePath(req.path, cwd);
  // Check for symlink escape (same as read handler)
  const parentDir = dirname(safePath);
  try {
    const realParent = realpathSync(parentDir);
    const realCwd = realpathSync(cwd);
    if (!realParent.startsWith(realCwd + "/") && realParent !== realCwd) {
      throwAcpError(-32002, `Path escapes session directory: ${req.path}`);
    }
  } catch (err: unknown) {
    // If parent doesn't exist yet, check further up
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      // Parent dir doesn't exist yet — resolveAndValidatePath already ensures lexical safety
      // The mkdir will create it within bounds
    } else {
      throw err;
    }
  }
  // Ensure parent directory exists
  mkdirSync(dirname(safePath), { recursive: true });
  writeFileSync(safePath, req.content, "utf-8");
  return {};
}
