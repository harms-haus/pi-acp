import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

import {
  writeJson,
  writeResponse,
  writeError,
  writeNotification,
  onShutdown,
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

  describe("writeOutgoing", () => {
    it("writes arbitrary outgoing JSON-RPC message", async () => {
      const { writeOutgoing: wo } = await import("../../src/transport/stdio.js");
      wo({ jsonrpc: "2.0", id: 1, result: "ok" as any });
      const parsed = JSON.parse(stdoutWrites[0].trim());
      expect(parsed).toEqual({ jsonrpc: "2.0", id: 1, result: "ok" });
    });
  });
});

describe("attachStdioReader", () => {
  let fakeStdin: EventEmitter & { setEncoding: ReturnType<typeof vi.fn> };
  let originalStdin: typeof process.stdin;

  beforeEach(async () => {
    vi.resetModules();
    fakeStdin = Object.assign(new EventEmitter(), { setEncoding: vi.fn() });
    originalStdin = process.stdin;
    Object.defineProperty(process, "stdin", { value: fakeStdin, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
  });

  it("calls onMessage for each newline-delimited line", async () => {
    const stdio = await import("../../src/transport/stdio.js");
    const onMessage = vi.fn();
    stdio.attachStdioReader(onMessage);

    const [dataListener] = fakeStdin.listeners("data") as ((chunk: Buffer) => void)[];
    dataListener(Buffer.from("line1\nline2\n"));

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenCalledWith("line1");
    expect(onMessage).toHaveBeenCalledWith("line2");
  });

  it("handles partial chunks (message split across multiple writes)", async () => {
    const stdio = await import("../../src/transport/stdio.js");
    const onMessage = vi.fn();
    stdio.attachStdioReader(onMessage);

    const [dataListener] = fakeStdin.listeners("data") as ((chunk: Buffer) => void)[];
    dataListener(Buffer.from("hel"));
    expect(onMessage).not.toHaveBeenCalled();
    dataListener(Buffer.from("lo\n"));
    expect(onMessage).toHaveBeenCalledWith("hello");
  });

  it("returns a dispose function that removes the listener", async () => {
    const stdio = await import("../../src/transport/stdio.js");
    const onMessage = vi.fn();
    const { dispose } = stdio.attachStdioReader(onMessage);

    expect(fakeStdin.listeners("data")).toHaveLength(1);
    dispose();
    expect(fakeStdin.listeners("data")).toHaveLength(0);
  });

  it("double dispose is a no-op", async () => {
    const stdio = await import("../../src/transport/stdio.js");
    const onMessage = vi.fn();
    const { dispose } = stdio.attachStdioReader(onMessage);

    dispose();
    // Calling dispose again should not throw
    dispose();
    expect(fakeStdin.listeners("data")).toHaveLength(0);
  });

  it("processes remaining buffer on stdin end", async () => {
    const stdio = await import("../../src/transport/stdio.js");
    const onMessage = vi.fn();
    stdio.attachStdioReader(onMessage);

    const [dataListener] = fakeStdin.listeners("data") as ((chunk: Buffer) => void)[];
    // Send a complete line first
    dataListener(Buffer.from("line1\n"));
    onMessage.mockClear();

    // Send an incomplete multi-byte UTF-8 sequence (0xC3 is first byte of a 2-byte char)
    dataListener(Buffer.from([0xc3]));

    // Trigger stdin end — decoder.end() flushes remaining bytes
    const [endListener] = fakeStdin.listeners("end") as (() => void)[];
    endListener();

    // The end handler flushes the incomplete byte from the decoder
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("handles CRLF line endings (\\r\\n)", async () => {
    const stdio = await import("../../src/transport/stdio.js");
    const onMessage = vi.fn();
    stdio.attachStdioReader(onMessage);

    const [dataListener] = fakeStdin.listeners("data") as ((chunk: Buffer) => void)[];
    dataListener(Buffer.from("line1\r\nline2\r\n"));

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenCalledWith("line1");
    expect(onMessage).toHaveBeenCalledWith("line2");
  });

  it("skips blank lines", async () => {
    const stdio = await import("../../src/transport/stdio.js");
    const onMessage = vi.fn();
    stdio.attachStdioReader(onMessage);

    const [dataListener] = fakeStdin.listeners("data") as ((chunk: Buffer) => void)[];
    dataListener(Buffer.from("line1\n\nline2\n"));

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenCalledWith("line1");
    expect(onMessage).toHaveBeenCalledWith("line2");
  });

  it("flushes remaining decoder data on stdin end", async () => {
    const stdio = await import("../../src/transport/stdio.js");
    const onMessage = vi.fn();
    stdio.attachStdioReader(onMessage);

    const [dataListener] = fakeStdin.listeners("data") as ((chunk: Buffer) => void)[];
    // Send an incomplete UTF-8 sequence that stays in the decoder
    dataListener(Buffer.from([0xc3]));

    const [endListener] = fakeStdin.listeners("end") as (() => void)[];
    endListener();

    // decoder.end() flushes the incomplete byte as a replacement character
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("does not call onMessage when end handler has no remaining data", async () => {
    const stdio = await import("../../src/transport/stdio.js");
    const onMessage = vi.fn();
    stdio.attachStdioReader(onMessage);

    // End stdin without sending any data
    const [endListener] = fakeStdin.listeners("end") as (() => void)[];
    endListener();

    expect(onMessage).not.toHaveBeenCalled();
  });
});

describe("onShutdown", () => {
  let fakeStdin: EventEmitter;
  let originalStdin: typeof process.stdin;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fakeStdin = new EventEmitter();
    originalStdin = process.stdin;
    Object.defineProperty(process, "stdin", { value: fakeStdin, configurable: true });
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
  });

  afterEach(() => {
    Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
    vi.restoreAllMocks();
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGHUP");
    process.removeAllListeners("SIGPIPE");
  });

  it("calls callback on SIGTERM", async () => {
    const callback = vi.fn();
    onShutdown(callback);

    process.emit("SIGTERM");

    expect(callback).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  it("deduplicates multiple signals (callback called only once)", async () => {
    const callback = vi.fn();
    onShutdown(callback);

    process.emit("SIGTERM");
    process.emit("SIGTERM");

    expect(callback).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("calls callback on stdin end", async () => {
    const callback = vi.fn();
    onShutdown(callback);

    fakeStdin.emit("end");

    expect(callback).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  it("calls callback on SIGPIPE", async () => {
    const callback = vi.fn();
    onShutdown(callback);

    process.emit("SIGPIPE");

    expect(callback).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  it("calls callback on SIGHUP", async () => {
    const callback = vi.fn();
    onShutdown(callback);

    process.emit("SIGHUP");

    expect(callback).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });
});
