import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock requireSession to control validation + lookup
const mockRequireSession = vi.fn();

vi.mock("../../src/pi/session-registry.js", () => ({
  requireSession: (...args: unknown[]) => mockRequireSession(...args),
}));

import { handleSessionResume } from "../../src/acp/methods/session-resume.js";

describe("handleSessionResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Returns {} for existing session ────────────────────────────────────
  it("returns empty object for existing session", async () => {
    mockRequireSession.mockReturnValue({
      entry: {
        session: {},
        cwd: "/tmp",
        createdAt: Date.now(),
        cancelling: false,
      },
      req: { sessionId: "sess_exists" },
    });

    const result = await handleSessionResume({ sessionId: "sess_exists" });

    expect(result).toEqual({});
    expect(mockRequireSession).toHaveBeenCalledWith(
      { sessionId: "sess_exists" },
      ["sessionId"],
    );
  });

  // ── 2. Throws when sessionId is missing ───────────────────────────────────
  it("throws -32602 when sessionId is missing", async () => {
    const error = new Error("Invalid params: missing 'sessionId'") as Error & {
      code: number;
    };
    error.code = -32602;
    mockRequireSession.mockImplementation(() => {
      throw error;
    });

    await expect(handleSessionResume({})).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  // ── 3. Throws -32002 when session not found ───────────────────────────────
  it("throws -32002 when session is not found", async () => {
    const error = new Error("Session not found: sess_nonexistent") as Error & {
      code: number;
    };
    error.code = -32002;
    mockRequireSession.mockImplementation(() => {
      throw error;
    });

    await expect(
      handleSessionResume({ sessionId: "sess_nonexistent" }),
    ).rejects.toThrow(expect.objectContaining({ code: -32002 }));
  });
});
