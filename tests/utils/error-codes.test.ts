import { describe, it, expect } from "vitest";

import {
  throwAcpError,
  makeErrorResponse,
  makeParseError,
  makeInvalidRequestError,
  makeMethodNotFoundError,
  makeInvalidParamsError,
  makeInternalError,
  makeAuthRequiredError,
  makeResourceNotFoundError,
} from "../../src/utils/error-codes.js";

describe("throwAcpError", () => {
  it("throws an object with correct code and message", () => {
    expect(() => throwAcpError(-32602, "Invalid params")).toThrow(
      expect.objectContaining({ code: -32602, message: "Invalid params" }),
    );
  });

  it("throws an object with data when provided", () => {
    expect(() => throwAcpError(-32600, "Bad request", { field: "name" })).toThrow(
      expect.objectContaining({ code: -32600, message: "Bad request", data: { field: "name" } }),
    );
  });

  it("never returns (returns never)", () => {
    // This test verifies the function throws by checking the type
    // If it didn't throw, the test would fail at the expect below
    let reached = false;
    try {
      throwAcpError(-32603, "Internal error");
      reached = true;
    } catch {
      // Expected
    }
    expect(reached).toBe(false);
  });
});

describe("makeErrorResponse", () => {
  it("creates a proper JSON-RPC error response", () => {
    const result = makeErrorResponse(1, -32600, "Invalid Request");
    expect(result).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32600, message: "Invalid Request" },
    });
  });

  it("includes optional data", () => {
    const result = makeErrorResponse("abc", -32602, "Invalid params", { extra: true });
    expect(result.error.data).toEqual({ extra: true });
  });

  it("handles null id", () => {
    const result = makeErrorResponse(null, -32700, "Parse error");
    expect(result.id).toBeNull();
  });
});

describe("error helper functions", () => {
  it("makeParseError returns -32700", () => {
    const result = makeParseError();
    expect(result.error.code).toBe(-32700);
    expect(result.error.message).toBe("Parse error");
  });

  it("makeInvalidRequestError returns -32600", () => {
    const result = makeInvalidRequestError("Custom message");
    expect(result.error.code).toBe(-32600);
    expect(result.error.message).toBe("Custom message");
  });

  it("makeMethodNotFoundError includes method name", () => {
    const result = makeMethodNotFoundError("test/method");
    expect(result.error.code).toBe(-32601);
    expect(result.error.message).toContain("test/method");
  });

  it("makeInvalidParamsError returns -32602", () => {
    const result = makeInvalidParamsError("Missing field");
    expect(result.error.code).toBe(-32602);
  });

  it("makeInternalError returns -32603", () => {
    const result = makeInternalError();
    expect(result.error.code).toBe(-32603);
    expect(result.error.message).toBe("Internal error");
  });

  it("makeAuthRequiredError returns -32000", () => {
    const result = makeAuthRequiredError();
    expect(result.error.code).toBe(-32000);
  });

  it("makeResourceNotFoundError returns -32002", () => {
    const result = makeResourceNotFoundError("File not found");
    expect(result.error.code).toBe(-32002);
    expect(result.error.message).toBe("File not found");
  });
});
