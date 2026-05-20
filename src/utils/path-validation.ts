// Path sanitization utility — prevents path traversal attacks.
import { resolve, isAbsolute } from "node:path";

import { ACP_ERROR_CODES } from "../acp/types.js";

import { throwAcpError } from "./error-codes.js";

/**
 * Resolve a path against the session's allowed roots and verify it doesn't escape.
 *
 * This performs **lexical** path resolution only — it does not follow symlinks.
 * Callers that need symlink protection should additionally call `assertWithinSandbox`
 * with `realpathSync`-resolved values.
 *
 * @param requestedPath - The path from the ACP request
 * @param cwd - The session's working directory (primary allowed root)
 * @param additionalDirs - Optional additional allowed directories
 * @returns The resolved absolute path if it is within an allowed root
 * @throws {Error} ACP error -32602 if the resolved path escapes all allowed roots
 */
export function resolveAndValidatePath(
  requestedPath: string,
  cwd: string,
  additionalDirs?: string[],
): string {
  // Always resolve to absolute path
  const resolved = isAbsolute(requestedPath) ? resolve(requestedPath) : resolve(cwd, requestedPath);

  // Build list of allowed roots
  const allowedRoots = [resolve(cwd)];
  if (additionalDirs) {
    for (const dir of additionalDirs) {
      allowedRoots.push(resolve(dir));
    }
  }

  // Check if resolved path is within any allowed root
  const isAllowed = allowedRoots.some(
    (root) => resolved.startsWith(root + "/") || resolved === root,
  );
  if (!isAllowed) {
    throwAcpError(
      ACP_ERROR_CODES.INVALID_PARAMS,
      `Path not allowed: ${requestedPath} (resolved to ${resolved}, outside session scope)`,
    );
  }

  return resolved;
}

/**
 * Check if a directory path is within an allowed root.
 */
export function isPathWithinRoot(dirPath: string, root: string): boolean {
  const resolvedDir = resolve(dirPath);
  const resolvedRoot = resolve(root);
  return resolvedDir.startsWith(resolvedRoot + "/") || resolvedDir === resolvedRoot;
}

/**
 * Assert that a realpath result is within the session sandbox (cwd).
 *
 * This must be called with values already resolved via `realpathSync` to detect
 * symlink-based directory escape attacks. Use after `resolveAndValidatePath` when
 * the file or directory is expected to exist on disk.
 *
 * @param realPath - The `realpathSync`-resolved path to check
 * @param realCwd - The `realpathSync`-resolved session working directory
 * @param requestedPath - The original requested path (used in error messages)
 * @param message - Optional custom error message
 * @throws {Error} ACP error -32002 if `realPath` is outside `realCwd`
 */
export function assertWithinSandbox(
  realPath: string,
  realCwd: string,
  requestedPath: string,
  message?: string,
): void {
  if (!realPath.startsWith(realCwd + "/") && realPath !== realCwd) {
    throwAcpError(ACP_ERROR_CODES.RESOURCE_NOT_FOUND, message ?? `Path escapes session directory: ${requestedPath}`);
  }
}
