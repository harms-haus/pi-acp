// Client-side file system method implementations — execute locally when the ACP client
// does NOT advertise the corresponding capabilities.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname } from "node:path";

import { getClientCapabilities } from "../acp/client-state.js";
import { sendClientRequest } from "../acp/protocol.js";
import {
  ACP_ERROR_CODES,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
} from "../acp/types.js";
import { getSession } from "../pi/session-registry.js";
import { throwAcpError } from "../utils/error-codes.js";
import { resolveAndValidatePath, assertWithinSandbox } from "../utils/path-validation.js";

/**
 * Handle the `fs/read_text_file` client method — reads a text file from the local filesystem.
 * Delegates to the ACP client if it advertises `fs.readTextFile` capability;
 * otherwise reads locally with path-traversal protection.
 * @param params - The `ReadTextFileRequest` with `path`, optional `sessionId`, `line`, and `limit`
 * @returns The file `content` as a string
 * @throws {Error} ACP error -32602 if `path` is missing
 * @throws {Error} ACP error -32002 if the path escapes the session sandbox (including via symlinks)
 */
export async function handleFsReadTextFile(
  params: Record<string, unknown> | undefined,
): Promise<ReadTextFileResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.fs?.readTextFile === true) {
    return sendClientRequest("fs/read_text_file", params ?? {}) as Promise<ReadTextFileResponse>;
  }
  const req = params as unknown as ReadTextFileRequest;
  if (!req.path) {
    throwAcpError(ACP_ERROR_CODES.INVALID_PARAMS, "Invalid params: path is required");
  }
  // Get session cwd for path validation
  const session = getSession(req.sessionId);
  const cwd = session?.cwd ?? process.cwd();
  // Validate and resolve path (prevents path traversal)
  const safePath = resolveAndValidatePath(req.path, cwd);
  // Also resolve realpath to catch symlinks escaping the sandbox
  const realPath = realpathSync(safePath);
  const realCwd = realpathSync(cwd);
  assertWithinSandbox(realPath, realCwd, req.path);
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

/**
 * Walk upward from `dir` to find the nearest existing ancestor and validate its realpath
 * is within the session sandbox. Used when the immediate parent doesn't exist yet.
 * @throws {Error} ACP error -32002 if the ancestor escapes the sandbox
 */
function validateAncestorWithinSandbox(dir: string, cwd: string, requestedPath: string): void {
  let checkDir = dirname(dir);
  while (checkDir !== dirname(checkDir)) {
    try {
      const realAncestor = realpathSync(checkDir);
      const realCwd = realpathSync(cwd);
      assertWithinSandbox(realAncestor, realCwd, requestedPath);
      return; // Safe — ancestor is within sandbox
    } catch (innerErr: unknown) {
      if (
        innerErr instanceof Error &&
        "code" in innerErr &&
        (innerErr as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        checkDir = dirname(checkDir);
      } else {
        throw innerErr;
      }
    }
  }
}

/**
 * Handle the `fs/write_text_file` client method — writes a text file to the local filesystem.
 * Delegates to the ACP client if it advertises `fs.writeTextFile` capability;
 * otherwise writes locally with path-traversal protection and auto-creates parent directories.
 * @param params - The `WriteTextFileRequest` with `path`, `content`, and optional `sessionId`
 * @returns An empty `WriteTextFileResponse`
 * @throws {Error} ACP error -32602 if `path` or `content` is missing
 * @throws {Error} ACP error -32002 if the path escapes the session sandbox (including via symlinks)
 */
export async function handleFsWriteTextFile(
  params: Record<string, unknown> | undefined,
): Promise<WriteTextFileResponse> {
  const clientCaps = getClientCapabilities();
  if (clientCaps?.fs?.writeTextFile === true) {
    return sendClientRequest("fs/write_text_file", params ?? {}) as Promise<WriteTextFileResponse>;
  }
  const req = params as unknown as WriteTextFileRequest;
  if (!req.path || typeof req.content !== "string") {
    throwAcpError(ACP_ERROR_CODES.INVALID_PARAMS, "Invalid params: path and content are required");
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
    assertWithinSandbox(realParent, realCwd, req.path);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      // Walk up to find existing ancestor and validate its realpath
      validateAncestorWithinSandbox(parentDir, cwd, req.path);
    } else {
      throw err;
    }
  }
  // Ensure parent directory exists
  mkdirSync(dirname(safePath), { recursive: true });
  writeFileSync(safePath, req.content, "utf-8");
  return {};
}
