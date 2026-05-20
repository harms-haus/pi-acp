import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
const mockSetSessionCancelling = vi.fn();
const mockCancelAllPermissions = vi.fn();
const mockAbort = vi.fn();

vi.mock("../../src/pi/session-registry.js", () => ({
  getSession: vi.fn(),
  setSessionCancelling: (...args: unknown[]) => mockSetSessionCancelling(...args),
}));

vi.mock("../../src/pi/acp-extension.js", () => ({
  cancelAllPermissions: (...args: unknown[]) => mockCancelAllPermissions(...args),
}));

import { handleSessionCancel } from "../../src/acp/methods/session-cancel.js";

import { getSession } from "../../src/pi/session-registry.js";

const mockedGetSession = vi.mocked(getSession);

describe("handleSessionCancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Returns undefined when params undefined ────────────────────────────
  it("returns undefined when params is undefined", async () => {
    const result = await handleSessionCancel(undefined);
    expect(result).toBeUndefined();
    expect(mockSetSessionCancelling).not.toHaveBeenCalled();
    expect(mockCancelAllPermissions).not.toHaveBeenCalled();
  });

  // ── 2. Returns undefined when session not found ───────────────────────────
  it("returns undefined when session is not found", async () => {
    mockedGetSession.mockReturnValue(undefined);

    const result = await handleSessionCancel({ sessionId: "nonexistent" });

    expect(result).toBeUndefined();
    expect(mockSetSessionCancelling).not.toHaveBeenCalled();
    expect(mockCancelAllPermissions).not.toHaveBeenCalled();
  });

  // ── 3. Sets cancelling flag, cancels permissions, and aborts session ──────
  it("sets cancelling flag, cancels permissions, and aborts session for valid session", async () => {
    mockAbort.mockResolvedValue(undefined);
    mockedGetSession.mockReturnValue({
      session: { abort: mockAbort } as any,
      cwd: "/tmp",
      createdAt: Date.now(),
      cancelling: false,
    });

    const result = await handleSessionCancel({ sessionId: "sess_active" });

    expect(result).toBeUndefined();
    expect(mockSetSessionCancelling).toHaveBeenCalledWith("sess_active", true);
    expect(mockCancelAllPermissions).toHaveBeenCalledOnce();
    expect(mockAbort).toHaveBeenCalledOnce();
  });

  // ── 4. Ignores errors from session.abort() ────────────────────────────────
  it("ignores errors from session.abort()", async () => {
    mockAbort.mockRejectedValue(new Error("abort failed"));
    mockedGetSession.mockReturnValue({
      session: { abort: mockAbort } as any,
      cwd: "/tmp",
      createdAt: Date.now(),
      cancelling: false,
    });

    // Should not throw
    const result = await handleSessionCancel({ sessionId: "sess_active" });

    expect(result).toBeUndefined();
    expect(mockAbort).toHaveBeenCalledOnce();
  });
});
