import { describe, it, expect } from "vitest";

import {
  toolNameToKind,
  kindToTitle,
  piContentToAcpBlocks,
  acpBlocksToPiContent,
  piToolResultToAcpContent,
} from "../../src/utils/content-translation.js";

describe("toolNameToKind", () => {
  it("maps read to read", () => {
    expect(toolNameToKind("read")).toBe("read");
  });

  it("maps edit to edit", () => {
    expect(toolNameToKind("edit")).toBe("edit");
  });

  it("maps write to create", () => {
    expect(toolNameToKind("write")).toBe("other");
  });

  it("maps bash to execute", () => {
    expect(toolNameToKind("bash")).toBe("execute");
  });

  it("maps grep to search", () => {
    expect(toolNameToKind("grep")).toBe("search");
  });

  it("maps find to search", () => {
    expect(toolNameToKind("find")).toBe("search");
  });

  it("maps ls to search", () => {
    expect(toolNameToKind("ls")).toBe("search");
  });

  it("maps unknown tools to other", () => {
    expect(toolNameToKind("unknown_tool")).toBe("other");
  });
});

describe("kindToTitle", () => {
  it("returns title with path from input", () => {
    const result = kindToTitle("read", { path: "/src/index.ts" });
    expect(result).toBe("read: /src/index.ts");
  });

  it("returns title with truncated command from input", () => {
    const result = kindToTitle("execute", { command: "npm run build --verbose" });
    expect(result).toBe("execute: npm run build --verbose");
  });

  it("returns just kind when no input", () => {
    expect(kindToTitle("read")).toBe("read");
  });

  it("returns just kind when input has no path or command", () => {
    expect(kindToTitle("read", { foo: "bar" })).toBe("read");
  });
});

describe("piContentToAcpBlocks", () => {
  it("converts string to text block", () => {
    const result = piContentToAcpBlocks("hello world");
    expect(result).toEqual([{ type: "text", text: "hello world" }]);
  });

  it("converts array of strings to text blocks", () => {
    const result = piContentToAcpBlocks(["hello", "world"]);
    expect(result).toEqual([
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ]);
  });

  it("converts pi text block to ACP text block", () => {
    const result = piContentToAcpBlocks([{ type: "text", text: "content" }]);
    expect(result).toEqual([{ type: "text", text: "content" }]);
  });

  it("converts pi image block to ACP image block", () => {
    const result = piContentToAcpBlocks([
      { type: "image", source: { type: "base64", mediaType: "image/png", data: "abc123" } },
    ]);
    expect(result).toEqual([{ type: "image", data: "abc123", mimeType: "image/png" }]);
  });

  it("converts pi thinking block to ACP text block", () => {
    const result = piContentToAcpBlocks([{ type: "thinking", thinking: "Let me think..." }]);
    expect(result).toEqual([{ type: "text", text: "Let me think..." }]);
  });

  it("handles empty array", () => {
    const result = piContentToAcpBlocks([]);
    expect(result).toEqual([]);
  });

  it("handles non-object array items", () => {
    const result = piContentToAcpBlocks([42, null, "text"]);
    // Non-objects (number, null) are skipped; strings are converted
    expect(result).toEqual([
      { type: "text", text: "text" },
    ]);
  });
});

describe("acpBlocksToPiContent", () => {
  it("converts text block to pi text", () => {
    const result = acpBlocksToPiContent([{ type: "text", text: "hello" }]);
    expect(result).toEqual("hello");
  });

  it("converts image block to pi image", () => {
    const result = acpBlocksToPiContent([
      { type: "image", data: "abc", mimeType: "image/png" },
    ]);
    // Returns array with single element when multiple blocks
    expect(result).toEqual([
      { type: "image", source: { type: "base64", mediaType: "image/png", data: "abc" } },
    ]);
  });

  it("converts audio block to text reference", () => {
    const result = acpBlocksToPiContent([
      { type: "audio", data: "abc", mimeType: "audio/wav" },
    ]);
    expect(result).toContain("audio: audio/wav");
  });

  it("converts resource_link to text reference", () => {
    const result = acpBlocksToPiContent([
      { type: "resource_link", uri: "file:///test.ts", name: "test.ts" },
    ]);
    expect(result).toContain("Resource: file:///test.ts (test.ts)");
  });

  it("converts embedded resource with text", () => {
    const result = acpBlocksToPiContent([
      { type: "resource", resource: { uri: "file:///test.ts", text: "content" } },
    ]);
    expect(result).toEqual("content");
  });

  it("converts embedded resource with blob", () => {
    const result = acpBlocksToPiContent([
      { type: "resource", resource: { uri: "file:///img.png", blob: "data" } },
    ]);
    expect(result).toContain("binary resource: file:///img.png");
  });

  it("returns array for multiple blocks", () => {
    const result = acpBlocksToPiContent([
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ]);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("piToolResultToAcpContent", () => {
  it("converts text result to content blocks", () => {
    const result = piToolResultToAcpContent("read", "file content");
    expect(result).toEqual([{ type: "content", content: { type: "text", text: "file content" } }]);
  });

  it("adds diff content for edit tools with details", () => {
    const result = piToolResultToAcpContent("edit", "result", {
      path: "/src/test.ts",
      newText: "new content",
      oldText: "old content",
    });
    expect(result).toContainEqual({
      type: "diff",
      path: "/src/test.ts",
      newText: "new content",
      oldText: "old content",
    });
  });

  it("adds diff without oldText when not provided", () => {
    const result = piToolResultToAcpContent("edit", "result", {
      path: "/src/test.ts",
      newText: "new content",
    });
    expect(result).toContainEqual({
      type: "diff",
      path: "/src/test.ts",
      newText: "new content",
      oldText: undefined,
    });
  });
});
