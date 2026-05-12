import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  writeJson,
  writeResponse,
  writeError,
  writeNotification,
} from "../../src/transport/stdio.js";

describe("stdio transport", () => {
  let stdoutWrites: string[];

  beforeEach(() => {
    stdoutWrites = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
      stdoutWrites.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString());
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("writeJson", () => {
    it("writes valid JSON followed by newline", () => {
      writeJson({ foo: "bar" });
      expect(stdoutWrites).toHaveLength(1);
      expect(stdoutWrites[0]).toBe('{"foo":"bar"}\n');
    });

    it("serializes complex objects", () => {
      writeJson({ arr: [1, 2], obj: { key: "val" } });
      const parsed = JSON.parse(stdoutWrites[0].trim());
      expect(parsed).toEqual({ arr: [1, 2], obj: { key: "val" } });
    });
  });

  describe("writeResponse", () => {
    it("writes JSON-RPC 2.0 success response with numeric id", () => {
      writeResponse(1, { result: "ok" });
      const parsed = JSON.parse(stdoutWrites[0].trim());
      expect(parsed).toEqual({
        jsonrpc: "2.0",
        id: 1,
        result: { result: "ok" },
      });
    });

    it("writes JSON-RPC 2.0 success response with string id", () => {
      writeResponse("abc", null);
      const parsed = JSON.parse(stdoutWrites[0].trim());
      expect(parsed).toEqual({
        jsonrpc: "2.0",
        id: "abc",
        result: null,
      });
    });

    it("writes JSON-RPC 2.0 success response with null id", () => {
      writeResponse(null, {});
      const parsed = JSON.parse(stdoutWrites[0].trim());
      expect(parsed.id).toBeNull();
    });
  });

  describe("writeError", () => {
    it("writes JSON-RPC 2.0 error response", () => {
      writeError(1, -32600, "Invalid Request");
      const parsed = JSON.parse(stdoutWrites[0].trim());
      expect(parsed).toEqual({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32600, message: "Invalid Request" },
      });
    });

    it("includes optional data field", () => {
      writeError(2, -32602, "Invalid params", { field: "name" });
      const parsed = JSON.parse(stdoutWrites[0].trim());
      expect(parsed.error.data).toEqual({ field: "name" });
    });
  });

  describe("writeNotification", () => {
    it("writes JSON-RPC 2.0 notification with params", () => {
      writeNotification("test/method", { key: "val" });
      const parsed = JSON.parse(stdoutWrites[0].trim());
      expect(parsed).toEqual({
        jsonrpc: "2.0",
        method: "test/method",
        params: { key: "val" },
      });
      expect(parsed).not.toHaveProperty("id");
    });

    it("writes JSON-RPC 2.0 notification without params", () => {
      writeNotification("test/method");
      const parsed = JSON.parse(stdoutWrites[0].trim());
      expect(parsed).toEqual({
        jsonrpc: "2.0",
        method: "test/method",
      });
    });
  });
});
