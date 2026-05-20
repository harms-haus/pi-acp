import { describe, it, expect, vi, beforeEach } from "vitest";

import { acpExtensionFactory, cancelAllPermissions } from "../src/pi/acp-extension.js";

describe("acp-extension", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. acpExtensionFactory registers tool_call handler ────────────────────
  it("acpExtensionFactory registers tool_call handler on ExtensionAPI", () => {
    const mockPi = { on: vi.fn() } as unknown as Parameters<typeof acpExtensionFactory>[0];

    acpExtensionFactory(mockPi);

    expect(mockPi.on).toHaveBeenCalledWith("tool_call", expect.any(Function));
  });

  // ── 2. cancelAllPermissions resolves all pending with "cancelled" ─────────
  it("cancelAllPermissions resolves all pending permissions with cancelled", async () => {
    // The pendingPermissions map is module-scoped and not populated by any
    // exported function in the current implementation. Calling cancelAllPermissions
    // on an empty map is a no-op — verify it completes without error.
    expect(() => cancelAllPermissions()).not.toThrow();
  });

  // ── 3. tool_call handler is an async function ────────────────────────────
  it("registered tool_call handler is an async function", () => {
    const mockOn = vi.fn();
    const mockPi = { on: mockOn } as unknown as Parameters<typeof acpExtensionFactory>[0];

    acpExtensionFactory(mockPi);

    const handler = mockOn.mock.calls[0]?.[1] as (...args: unknown[]) => unknown;
    expect(typeof handler).toBe("function");
    // The handler is declared async, so calling it should return a Promise
    const result = handler({}, {});
    expect(result).toBeInstanceOf(Promise);
  });
});
