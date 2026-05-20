import { describe, it, expect, vi, beforeEach } from "vitest";

// Session registry uses module-level state (Map + counter).
// Reset modules so each test gets a fresh registry instance.
beforeEach(() => {
  vi.resetModules();
});

// Helper to dynamically import a fresh registry and create a mock session.
async function freshRegistry() {
  const reg = await import("../src/pi/session-registry.js");
  const session = { dispose: vi.fn() };
  return { reg, session };
}

describe("session-registry", () => {
  // ── 1. registerSession returns unique ID starting with "sess_" ───────────
  it("registerSession returns unique ID starting with sess_", async () => {
    const { reg, session } = await freshRegistry();

    const id = reg.registerSession(session, "/tmp");

    expect(id).toMatch(/^sess_\d+_\d+$/);
  });

  // ── 2. registerSession stores session and getSession retrieves it ────────
  it("getSession returns entry for valid ID, undefined for invalid", async () => {
    const { reg, session } = await freshRegistry();

    const id = reg.registerSession(session, "/tmp/project");

    const entry = reg.getSession(id);
    expect(entry).toBeDefined();
    if (!entry) throw new Error("entry should exist");
    expect(entry.session).toBe(session);
    expect(entry.cwd).toBe("/tmp/project");
    expect(entry.cancelling).toBe(false);

    expect(reg.getSession("nonexistent")).toBeUndefined();
  });

  // ── 3. removeSession calls dispose and removes from map ─────────────────
  it("removeSession calls dispose and removes entry", async () => {
    const { reg, session } = await freshRegistry();

    const id = reg.registerSession(session, "/tmp");

    reg.removeSession(id);

    expect(session.dispose).toHaveBeenCalledOnce();
    expect(reg.getSession(id)).toBeUndefined();
  });

  // ── 4. removeSession on nonexistent ID does nothing ──────────────────────
  it("removeSession on nonexistent ID does nothing", async () => {
    const { reg } = await freshRegistry();

    // Should not throw
    expect(() => {
      reg.removeSession("no_such_id");
    }).not.toThrow();
  });

  // ── 5. listSessions returns all sessions ─────────────────────────────────
  it("listSessions returns all sessions", async () => {
    const { reg } = await freshRegistry();

    const s1 = { dispose: vi.fn() };
    const s2 = { dispose: vi.fn() };

    const id1 = reg.registerSession(s1, "/a");
    const id2 = reg.registerSession(s2, "/b");

    const list = reg.listSessions();

    expect(list).toHaveLength(2);
    const ids = list.map((s) => s.sessionId);
    expect(ids).toContain(id1);
    expect(ids).toContain(id2);

    // Check shape of SessionInfo
    const entry1 = list.find((s) => s.sessionId === id1);
    if (!entry1) throw new Error("entry1 should exist");
    expect(entry1.cwd).toBe("/a");
    expect(typeof entry1.updatedAt).toBe("string"); // ISO string
  });

  // ── 6. listSessions with cwd filter ──────────────────────────────────────
  it("listSessions with cwd filter returns only matching sessions", async () => {
    const { reg } = await freshRegistry();

    reg.registerSession({ dispose: vi.fn() }, "/alpha");
    const idBeta = reg.registerSession({ dispose: vi.fn() }, "/beta");
    reg.registerSession({ dispose: vi.fn() }, "/gamma");

    const filtered = reg.listSessions("/beta");

    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessionId).toBe(idBeta);
    expect(filtered[0].cwd).toBe("/beta");
  });

  // ── 7. setTurnId / getTurnId ─────────────────────────────────────────────
  it("setTurnId / getTurnId stores and retrieves turn ID", async () => {
    const { reg, session } = await freshRegistry();

    const id = reg.registerSession(session, "/tmp");

    expect(reg.getTurnId(id)).toBeUndefined();

    reg.setTurnId(id, "turn_42");

    expect(reg.getTurnId(id)).toBe("turn_42");
  });

  // ── 8. getTurnId for nonexistent session returns undefined ───────────────
  it("getTurnId returns undefined for nonexistent session", async () => {
    const { reg } = await freshRegistry();

    expect(reg.getTurnId("no_such_session")).toBeUndefined();
  });

  // ── 9. setPromptRequestId / getPromptRequestId ───────────────────────────
  it("setPromptRequestId / getPromptRequestId stores and retrieves request ID", async () => {
    const { reg, session } = await freshRegistry();

    const id = reg.registerSession(session, "/tmp");

    // number
    reg.setPromptRequestId(id, 42);
    expect(reg.getPromptRequestId(id)).toBe(42);

    // string
    reg.setPromptRequestId(id, "req_abc");
    expect(reg.getPromptRequestId(id)).toBe("req_abc");

    // null
    reg.setPromptRequestId(id, null);
    expect(reg.getPromptRequestId(id)).toBeNull();
  });

  // ── 10. setSessionCancelling / isSessionCancelling ───────────────────────
  it("setSessionCancelling / isSessionCancelling tracks cancellation state", async () => {
    const { reg, session } = await freshRegistry();

    const id = reg.registerSession(session, "/tmp");

    expect(reg.isSessionCancelling(id)).toBe(false);

    reg.setSessionCancelling(id, true);
    expect(reg.isSessionCancelling(id)).toBe(true);

    reg.setSessionCancelling(id, false);
    expect(reg.isSessionCancelling(id)).toBe(false);
  });

  // ── 11. isSessionCancelling defaults to false ────────────────────────────
  it("isSessionCancelling returns false for nonexistent session", async () => {
    const { reg } = await freshRegistry();

    expect(reg.isSessionCancelling("no_such_session")).toBe(false);
  });

  // ── 12. getSessionIds returns all registered IDs ─────────────────────────
  it("getSessionIds returns all registered IDs", async () => {
    const { reg } = await freshRegistry();

    expect(reg.getSessionIds()).toEqual([]);

    const id1 = reg.registerSession({ dispose: vi.fn() }, "/a");
    const id2 = reg.registerSession({ dispose: vi.fn() }, "/b");

    const ids = reg.getSessionIds();
    expect(ids).toEqual([id1, id2]);

    // After removing one
    reg.removeSession(id1);
    expect(reg.getSessionIds()).toEqual([id2]);
  });
});
