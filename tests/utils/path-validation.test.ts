import { describe, it, expect } from "vitest";

import { resolveAndValidatePath, isPathWithinRoot } from "../../src/utils/path-validation.js";

describe("resolveAndValidatePath", () => {
  const cwd = "/home/user/project";

  it("resolves relative paths against cwd", () => {
    const result = resolveAndValidatePath("src/index.ts", cwd);
    expect(result).toBe("/home/user/project/src/index.ts");
  });

  it("resolves absolute paths directly", () => {
    const result = resolveAndValidatePath("/home/user/project/file.txt", cwd);
    expect(result).toBe("/home/user/project/file.txt");
  });

  it("allows paths within cwd", () => {
    const result = resolveAndValidatePath("deep/nested/file.txt", cwd);
    expect(result).toBe("/home/user/project/deep/nested/file.txt");
  });

  it("allows cwd itself", () => {
    const result = resolveAndValidatePath(".", cwd);
    expect(result).toBe("/home/user/project");
  });

  it("allows relative paths resolved against cwd even when additionalDirs specified", () => {
    // Relative paths are always resolved against cwd first
    const result = resolveAndValidatePath("lib/utils.ts", cwd, ["/home/user/lib"]);
    expect(result).toBe("/home/user/project/lib/utils.ts");
  });

  it("allows absolute paths within additionalDirs", () => {
    const result = resolveAndValidatePath("/home/user/lib/file.ts", cwd, ["/home/user/lib"]);
    expect(result).toBe("/home/user/lib/file.ts");
  });

  it("rejects path traversal with ..", () => {
    expect(() => resolveAndValidatePath("../../etc/passwd", cwd)).toThrow("Path not allowed");
  });

  it("rejects path traversal from subdirectory", () => {
    expect(() => resolveAndValidatePath("src/../../../etc/passwd", cwd)).toThrow(
      "Path not allowed",
    );
  });

  it("rejects paths outside session scope", () => {
    expect(() => resolveAndValidatePath("/tmp/malicious.sh", cwd)).toThrow("Path not allowed");
  });

  it("rejects paths outside additionalDirs scope", () => {
    expect(() => resolveAndValidatePath("/other/dir/file.txt", cwd, ["/home/user/lib"])).toThrow(
      "Path not allowed",
    );
  });

  it("handles empty relative path", () => {
    const result = resolveAndValidatePath("", cwd);
    expect(result).toBe("/home/user/project");
  });
});

describe("isPathWithinRoot", () => {
  it("returns true for paths within root", () => {
    expect(isPathWithinRoot("/home/user/project/src", "/home/user/project")).toBe(true);
  });

  it("returns true for root itself", () => {
    expect(isPathWithinRoot("/home/user/project", "/home/user/project")).toBe(true);
  });

  it("returns false for paths outside root", () => {
    expect(isPathWithinRoot("/home/user/other", "/home/user/project")).toBe(false);
  });

  it("returns false for paths with similar prefix but different directory", () => {
    expect(isPathWithinRoot("/home/user/project-backup", "/home/user/project")).toBe(false);
  });

  it("handles trailing slashes on root", () => {
    expect(isPathWithinRoot("/home/user/project/src", "/home/user/project/")).toBe(true);
  });
});
