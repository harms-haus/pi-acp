import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock session-registry before importing the module under test
vi.mock("../src/pi/session-registry.js", () => ({
  getSession: vi.fn(),
  setPromptRequestId: vi.fn(),
  setSessionCancelling: vi.fn(),
  isSessionCancelling: vi.fn().mockReturnValue(false),
}));

vi.mock("../src/utils/content-translation.js", () => ({
  acpBlocksToPiContent: vi.fn().mockReturnValue("mocked prompt"),
}));

vi.mock("../src/pi/event-translator.js", () => ({
  handlePiEvent: vi.fn(),
}));

import { handleSessionPrompt, determineStopReason } from "../src/acp/methods/session-prompt.js";

import { getSession, isSessionCancelling } from "../src/pi/session-registry.js";

const mockedGetSession = vi.mocked(getSession);
const mockedIsSessionCancelling = vi.mocked(isSessionCancelling);

describe("determineStopReason", () => {
  const sessionId = "sess_test_123";

  beforeEach(() => {
    mockedIsSessionCancelling.mockReturnValue(false);
  });

  // ── 1. refusal ────────────────────────────────────────────────────────────
  it("returns 'refusal' when errorMessage contains 'refusal'", () => {
    const state = { errorMessage: "Model returned a refusal response" };
    expect(determineStopReason(state, sessionId)).toBe("refusal");
  });

  // ── 2. max_tokens ─────────────────────────────────────────────────────────
  it("returns 'max_tokens' when errorMessage contains 'max_tokens'", () => {
    const state = { errorMessage: "Hit max_tokens limit" };
    expect(determineStopReason(state, sessionId)).toBe("max_tokens");
  });

  // ── 3. cancelled ──────────────────────────────────────────────────────────
  it("returns 'cancelled' when session is cancelling", () => {
    mockedIsSessionCancelling.mockReturnValue(true);
    const state = { errorMessage: undefined };
    expect(determineStopReason(state, sessionId)).toBe("cancelled");
  });

  // ── 4. max_turn_requests ──────────────────────────────────────────────────
  it("returns 'max_turn_requests' when errorMessage contains 'max_turn'", () => {
    const state = { errorMessage: "Reached max_turn limit" };
    expect(determineStopReason(state, sessionId)).toBe("max_turn_requests");
  });

  // ── 5. end_turn (default) ─────────────────────────────────────────────────
  it("returns 'end_turn' as default", () => {
    const state = { errorMessage: undefined };
    expect(determineStopReason(state, sessionId)).toBe("end_turn");
  });

  // ── 6. not just any "max" ─────────────────────────────────────────────────
  it("error with 'maximum' should NOT return max_turn_requests", () => {
    const state = { errorMessage: "maximum retries exceeded" };
    expect(determineStopReason(state, sessionId)).not.toBe("max_turn_requests");
    expect(determineStopReason(state, sessionId)).toBe("end_turn");
  });
});

describe("handleSessionPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 7. missing sessionId ──────────────────────────────────────────────────
  it("throws -32602 when sessionId is missing", async () => {
    await expect(
      handleSessionPrompt({ prompt: [{ type: "text", text: "hello" }] }, { id: 1 }),
    ).rejects.toThrow(expect.objectContaining({ code: -32602 }));
  });

  // ── 8. missing prompt ─────────────────────────────────────────────────────
  it("throws -32602 when prompt is missing", async () => {
    await expect(handleSessionPrompt({ sessionId: "sess_123" }, { id: 1 })).rejects.toThrow(
      expect.objectContaining({ code: -32602 }),
    );
  });

  // ── 9. session not found ──────────────────────────────────────────────────
  it("throws -32002 when session is not found", async () => {
    mockedGetSession.mockReturnValue(undefined);

    await expect(
      handleSessionPrompt(
        { sessionId: "sess_nonexistent", prompt: [{ type: "text", text: "hello" }] },
        { id: 1 },
      ),
    ).rejects.toThrow(expect.objectContaining({ code: -32002 }));
  });
});
