import { describe, it, expect } from "vitest";

import { generateTurnId, extractTurnIdFromMessage } from "../../src/utils/turn-id.js";

describe("generateTurnId", () => {
  it("returns a string", () => {
    expect(typeof generateTurnId()).toBe("string");
  });

  it("returns unique IDs on consecutive calls", () => {
    const id1 = generateTurnId();
    const id2 = generateTurnId();
    const id3 = generateTurnId();
    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).not.toBe(id3);
  });

  it("format includes timestamp and counter", () => {
    const id = generateTurnId();
    expect(id).toMatch(/^turn-\d+-\d+$/);
  });
});

describe("extractTurnIdFromMessage", () => {
  it("returns a string with replay- prefix", () => {
    const result = extractTurnIdFromMessage("msg-123");
    expect(result).toMatch(/^replay-/);
  });

  it("includes the entryId in the result", () => {
    const result = extractTurnIdFromMessage("msg-456");
    expect(result).toBe("replay-msg-456");
  });

  it("handles empty entryId", () => {
    const result = extractTurnIdFromMessage("");
    expect(result).toBe("replay-");
  });
});
