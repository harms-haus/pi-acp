import { describe, it, expect } from "vitest";

import { generateTurnId } from "../../src/utils/turn-id.js";

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
