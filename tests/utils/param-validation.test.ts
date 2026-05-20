import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock throwAcpError so it actually throws with code + message
vi.mock("../../src/utils/error-codes.js", () => ({
  throwAcpError: vi.fn((code: number, message: string): never => {
    const error = new Error(message) as Error & { code: number };
    error.code = code;
    throw error;
  }),
}));

import { requireParams } from "../../src/utils/param-validation.js";

import { throwAcpError } from "../../src/utils/error-codes.js";

const mockedThrowAcpError = vi.mocked(throwAcpError);

describe("requireParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Returns params object when all keys present ────────────────────────
  it("returns params object when all keys present", () => {
    const params = { sessionId: "sess_1", cwd: "/tmp" };
    const result = requireParams<{ sessionId: string; cwd: string }>(params, [
      "sessionId",
      "cwd",
    ]);
    expect(result).toBe(params);
  });

  // ── 2. Throws with -32602 when params is undefined ────────────────────────
  it("throws with -32602 when params is undefined", () => {
    expect(() => requireParams(undefined, ["key"])).toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  // ── 3. Throws when params is null ─────────────────────────────────────────
  it("throws with -32602 when params is null", () => {
    expect(() => requireParams(null, ["key"])).toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  // ── 4. Throws when params is a string (non-object) ────────────────────────
  it("throws with -32602 when params is a string", () => {
    expect(() => requireParams("hello", ["key"])).toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  // ── 5. Throws when params is an array ─────────────────────────────────────
  it("throws with -32602 when params is an array", () => {
    expect(() => requireParams([1, 2, 3], ["key"])).toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  // ── 6. Throws with missing key name in message ────────────────────────────
  it("throws with missing key name in message", () => {
    expect(() => requireParams({}, ["sessionId"])).toThrow(/missing 'sessionId'/);
  });

  // ── 7. Throws with typeName in message when provided ──────────────────────
  it("throws with typeName in message when provided", () => {
    expect(() => requireParams(undefined, ["key"], "PromptRequest")).toThrow(
      /expected PromptRequest/,
    );
  });

  // ── 8. Throws without typeName when not provided ──────────────────────────
  it("throws with generic message when typeName is not provided", () => {
    expect(() => requireParams(undefined, ["key"])).toThrow(/expected an object/);
  });

  // ── 9. Works with empty keys array (just validates object) ────────────────
  it("works with empty keys array — just validates it is an object", () => {
    const params = { foo: "bar" };
    const result = requireParams(params, []);
    expect(result).toBe(params);
  });

  // ── 10. Works with multiple required keys ─────────────────────────────────
  it("returns params when multiple required keys are all present", () => {
    const params = { sessionId: "s1", cwd: "/tmp", prompt: "hello" };
    const result = requireParams<{
      sessionId: string;
      cwd: string;
      prompt: string;
    }>(params, ["sessionId", "cwd", "prompt"]);
    expect(result).toBe(params);
  });

  // ── 11. Calls throwAcpError for invalid params type ───────────────────────
  it("delegates to throwAcpError for invalid params", () => {
    try {
      requireParams(undefined, ["key"]);
    } catch {
      // Expected — throwAcpError throws
    }
    expect(mockedThrowAcpError).toHaveBeenCalledWith(-32602, expect.any(String));
  });

  // ── 12. Calls throwAcpError for missing key ───────────────────────────────
  it("delegates to throwAcpError for missing key", () => {
    try {
      requireParams({}, ["missingKey"]);
    } catch {
      // Expected
    }
    expect(mockedThrowAcpError).toHaveBeenCalledWith(
      -32602,
      "Invalid params: missing 'missingKey'",
    );
  });
});
