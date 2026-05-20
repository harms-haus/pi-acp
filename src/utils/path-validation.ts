// Path sanitization utility — prevents path traversal attacks.
import { resolve, isAbsolute } from "node:path";

/**
 * Resolve a path against the session's allowed roots and verify it doesn't escape.
 * Returns the resolved path if valid, or throws an error.
 *
 * @param requestedPath — The path from the ACP request
 * @param cwd — The session's working directory (primary allowed root)
 * @param additionalDirs — Optional additional allowed directories
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
    throw new Error(
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
