import { describe, it, expect } from "vitest";

import { throwAcpError } from "../../src/utils/error-codes.js";

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
