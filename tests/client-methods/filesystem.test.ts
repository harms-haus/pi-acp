import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Use vi.hoisted so the mock functions are available in hoisted vi.mock factories
const { mockGetClientCapabilities, mockSendClientRequest, mockGetSession } = vi.hoisted(() => ({
  mockGetClientCapabilities: vi.fn(),
  mockSendClientRequest: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock("../../src/acp/client-state.js", () => ({
  getClientCapabilities: mockGetClientCapabilities,
}));

vi.mock("../../src/acp/protocol.js", () => ({
  sendClientRequest: mockSendClientRequest,
}));

vi.mock("../../src/pi/session-registry.js", () => ({
  getSession: mockGetSession,
}));

import {
  handleFsReadTextFile,
  handleFsWriteTextFile,
} from "../../src/client-methods/filesystem.js";

describe("handleFsReadTextFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "pi-acp-fs-test-"));
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: tempDir });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("delegates to sendClientRequest when client has capability", async () => {
    mockGetClientCapabilities.mockReturnValue({ fs: { readTextFile: true } });
    mockSendClientRequest.mockResolvedValue({ content: "remote content" });

    const result = await handleFsReadTextFile({ path: "/some/file.txt" });

    expect(mockSendClientRequest).toHaveBeenCalledWith("fs/read_text_file", {
      path: "/some/file.txt",
    });
    expect(result).toEqual({ content: "remote content" });
  });

  it("throws -32602 when path is missing", async () => {
    await expect(handleFsReadTextFile({})).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  it("throws -32602 when path is empty string", async () => {
    await expect(handleFsReadTextFile({ path: "" })).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  it("throws for path traversal outside session directory", async () => {
    await expect(
      handleFsReadTextFile({ path: "../../etc/passwd", sessionId: "sess_1" }),
    ).rejects.toThrow("Path not allowed");
  });

  it("throws for absolute path outside session directory", async () => {
    await expect(
      handleFsReadTextFile({ path: "/etc/passwd", sessionId: "sess_1" }),
    ).rejects.toThrow("Path not allowed");
  });

  it("returns file content for a valid file", async () => {
    const filePath = join(tempDir, "hello.txt");
    writeFileSync(filePath, "hello world", "utf8");

    const result = await handleFsReadTextFile({ path: filePath, sessionId: "sess_1" });

    expect(result).toEqual({ content: "hello world" });
  });

  it("returns file content for a relative path within session dir", async () => {
    writeFileSync(join(tempDir, "notes.txt"), "some notes", "utf8");

    const result = await handleFsReadTextFile({ path: "notes.txt", sessionId: "sess_1" });

    expect(result).toEqual({ content: "some notes" });
  });

  it("returns sliced content when line is specified", async () => {
    const content = "line1\nline2\nline3\nline4\nline5";
    writeFileSync(join(tempDir, "multiline.txt"), content, "utf8");

    const result = await handleFsReadTextFile({
      path: "multiline.txt",
      line: 2,
      sessionId: "sess_1",
    });

    expect(result).toEqual({ content: "line2\nline3\nline4\nline5" });
  });

  it("returns sliced content when line and limit are specified", async () => {
    const content = "line1\nline2\nline3\nline4\nline5";
    writeFileSync(join(tempDir, "sliced.txt"), content, "utf8");

    const result = await handleFsReadTextFile({
      path: "sliced.txt",
      line: 2,
      limit: 2,
      sessionId: "sess_1",
    });

    expect(result).toEqual({ content: "line2\nline3" });
  });

  it("returns sliced content when only limit is specified (starts from line 1)", async () => {
    const content = "line1\nline2\nline3\nline4\nline5";
    writeFileSync(join(tempDir, "limited.txt"), content, "utf8");

    const result = await handleFsReadTextFile({
      path: "limited.txt",
      limit: 2,
      sessionId: "sess_1",
    });

    expect(result).toEqual({ content: "line1\nline2" });
  });

  it("throws when reading a symlink that escapes the session directory", async () => {
    const { symlinkSync, mkdirSync } = await import("node:fs");
    // Create a subdirectory and a symlink pointing outside the sandbox
    const subDir = join(tempDir, "sub");
    mkdirSync(subDir, { recursive: true });
    const linkPath = join(subDir, "escape_link");
    symlinkSync("/etc/passwd", linkPath);

    await expect(
      handleFsReadTextFile({ path: linkPath, sessionId: "sess_1" }),
    ).rejects.toThrow("Path escapes session directory");
  });

  it("throws ENOENT when reading a non-existent file", async () => {
    await expect(
      handleFsReadTextFile({ path: "nonexistent_file.txt", sessionId: "sess_1" }),
    ).rejects.toThrow();
  });
});

describe("handleFsWriteTextFile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "pi-acp-fs-test-"));
    mockGetClientCapabilities.mockReturnValue(null);
    mockGetSession.mockReturnValue({ cwd: tempDir });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("delegates to sendClientRequest when client has capability", async () => {
    mockGetClientCapabilities.mockReturnValue({ fs: { writeTextFile: true } });
    mockSendClientRequest.mockResolvedValue({});

    const result = await handleFsWriteTextFile({ path: "/some/file.txt", content: "data" });

    expect(mockSendClientRequest).toHaveBeenCalledWith("fs/write_text_file", {
      path: "/some/file.txt",
      content: "data",
    });
    expect(result).toEqual({});
  });

  it("throws -32602 when path is missing", async () => {
    await expect(handleFsWriteTextFile({ content: "data" })).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  it("throws -32602 when content is missing", async () => {
    await expect(handleFsWriteTextFile({ path: "file.txt" })).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  it("throws -32602 when both path and content are missing", async () => {
    await expect(handleFsWriteTextFile({})).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  it("writes file and returns empty object", async () => {
    const filePath = join(tempDir, "output.txt");

    const result = await handleFsWriteTextFile({
      path: filePath,
      content: "written content",
      sessionId: "sess_1",
    });

    expect(result).toEqual({});
    const written = readFileSync(filePath, "utf8");
    expect(written).toBe("written content");
  });

  it("writes file with relative path", async () => {
    const result = await handleFsWriteTextFile({
      path: "relative.txt",
      content: "relative content",
      sessionId: "sess_1",
    });

    expect(result).toEqual({});
    const written = readFileSync(join(tempDir, "relative.txt"), "utf8");
    expect(written).toBe("relative content");
  });

  it("creates parent directories if needed", async () => {
    const result = await handleFsWriteTextFile({
      path: "deep/nested/dir/file.txt",
      content: "nested",
      sessionId: "sess_1",
    });

    expect(result).toEqual({});
    const written = readFileSync(join(tempDir, "deep/nested/dir/file.txt"), "utf8");
    expect(written).toBe("nested");
  });

  it("throws for path traversal outside session directory", async () => {
    await expect(
      handleFsWriteTextFile({
        path: "../../tmp/malicious.sh",
        content: "evil",
        sessionId: "sess_1",
      }),
    ).rejects.toThrow("Path not allowed");
  });

  it("throws for absolute path outside session directory", async () => {
    await expect(
      handleFsWriteTextFile({
        path: "/tmp/malicious.sh",
        content: "evil",
        sessionId: "sess_1",
      }),
    ).rejects.toThrow("Path not allowed");
  });
});
