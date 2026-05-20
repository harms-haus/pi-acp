import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the transport module so we can spy on all write functions
vi.mock("../src/transport/stdio.js", () => ({
  writeJson: vi.fn(),
  writeResponse: vi.fn(),
  writeError: vi.fn(),
  writeNotification: vi.fn(),
  writeOutgoing: vi.fn(),
  attachStdioReader: vi.fn(),
  onShutdown: vi.fn(),
}));

import {
  registerHandler,
  processMessage,
  sendClientRequest,
  writeResponse,
  writeError,
} from "../src/acp/protocol.js";

import { writeOutgoing } from "../src/transport/stdio.js";

const mockedWriteResponse = vi.mocked(writeResponse);
const mockedWriteError = vi.mocked(writeError);
const mockedWriteOutgoing = vi.mocked(writeOutgoing);

describe("protocol", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Valid request routed to handler ────────────────────────────────────
  it("routes valid request to registered handler", async () => {
    const handler = vi.fn().mockResolvedValue({ status: "ok" });
    registerHandler("test/routed", handler);

    await processMessage(
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "test/routed", params: { key: "val" } }),
    );

    expect(handler).toHaveBeenCalledWith(
      { key: "val" },
      expect.objectContaining({ method: "test/routed", id: 1 }),
    );
    expect(mockedWriteResponse).toHaveBeenCalledWith(1, { status: "ok" });
  });

  // ── 2. Invalid JSON → parse error ─────────────────────────────────────────
  it("returns parse error for invalid JSON", async () => {
    await processMessage("not json");

    expect(mockedWriteError).toHaveBeenCalledWith(null, -32700, "Parse error", {
      raw: "not json",
    });
  });

  // ── 3. Missing jsonrpc field → invalid request ────────────────────────────
  it("returns invalid request for missing jsonrpc field", async () => {
    await processMessage(JSON.stringify({ method: "test" }));

    expect(mockedWriteError).toHaveBeenCalledWith(null, -32600, "Invalid Request", {
      raw: '{"method":"test"}',
    });
  });

  // ── 4. Unknown method → method not found ──────────────────────────────────
  it("returns method not found for unknown method", async () => {
    await processMessage(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "nonexistent" }));

    expect(mockedWriteError).toHaveBeenCalledWith(2, -32601, "Method not found: nonexistent");
  });

  // ── 5. Handler throws with code → error with that code ────────────────────
  it("returns handler error code when handler throws with code", async () => {
    const handler = vi.fn().mockImplementation(() => {
      const err = new Error("Custom error") as Error & { code: number; data: unknown };
      err.code = -32000;
      err.data = { detail: "something" };
      throw err;
    });
    registerHandler("test/throws_code", handler);

    await processMessage(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "test/throws_code" }));

    expect(mockedWriteError).toHaveBeenCalledWith(3, -32000, "Custom error", {
      detail: "something",
    });
  });

  // ── 6. Handler throws without code → internal error ───────────────────────
  it("returns internal error when handler throws without code", async () => {
    const handler = vi.fn().mockImplementation(() => {
      throw new Error("plain error");
    });
    registerHandler("test/throws_plain", handler);

    // Suppress console.error output from the internal error path
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await processMessage(JSON.stringify({ jsonrpc: "2.0", id: 4, method: "test/throws_plain" }));

    expect(mockedWriteError).toHaveBeenCalledWith(4, -32603, "Internal error");
    consoleSpy.mockRestore();
  });

  // ── 7. Notification (no id) — handler called but no response ──────────────
  it("handles notification without id — handler called, no response written", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerHandler("test/notification", handler);

    await processMessage(
      JSON.stringify({ jsonrpc: "2.0", method: "test/notification", params: { x: 1 } }),
    );

    expect(handler).toHaveBeenCalledWith(
      { x: 1 },
      expect.objectContaining({ method: "test/notification", id: null }),
    );
    expect(mockedWriteResponse).not.toHaveBeenCalled();
    expect(mockedWriteError).not.toHaveBeenCalled();
  });

  // ── 8. Unknown notification — silently ignored ────────────────────────────
  it("silently ignores unknown notification", async () => {
    await processMessage(JSON.stringify({ jsonrpc: "2.0", method: "unknown/notification" }));

    expect(mockedWriteResponse).not.toHaveBeenCalled();
    expect(mockedWriteError).not.toHaveBeenCalled();
  });

  // ── 9. Client response resolves pending request ───────────────────────────
  it("resolves pending client request on response", async () => {
    const promise = sendClientRequest("test/client_resolve", { key: "val" });

    // Capture the request ID that was sent outbound
    const outgoingCall = mockedWriteOutgoing.mock.calls.at(-1)!;
    const outgoingMsg = outgoingCall[0] as Record<string, unknown>;
    const id = outgoingMsg.id;

    expect(outgoingMsg).toMatchObject({
      jsonrpc: "2.0",
      method: "test/client_resolve",
      params: { key: "val" },
    });

    // Simulate the client sending back a response
    await processMessage(JSON.stringify({ jsonrpc: "2.0", id, result: "yes" }));

    await expect(promise).resolves.toBe("yes");
  });

  // ── 10. Client error response rejects pending request ─────────────────────
  it("rejects pending client request on error response", async () => {
    const promise = sendClientRequest("test/client_reject", {});

    const outgoingCall = mockedWriteOutgoing.mock.calls.at(-1)!;
    const id = (outgoingCall[0] as Record<string, unknown>).id;

    await processMessage(
      JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: { code: -32000, message: "Permission denied" },
      }),
    );

    await expect(promise).rejects.toThrow("Client error -32000: Permission denied");
  });

  // ── 11. sendClientRequest timeout ─────────────────────────────────────────
  it("sendClientRequest times out after 60s", async () => {
    vi.useFakeTimers();
    try {
      const promise = sendClientRequest("test/timeout_method", {});

      vi.advanceTimersByTime(60_000);

      await expect(promise).rejects.toThrow("Client request test/timeout_method timed out");
    } finally {
      vi.useRealTimers();
    }
  });
});
