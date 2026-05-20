// Shared mutable client state — initialized during the ACP handshake.
// Split out of initialize.ts to avoid cross-layer dependencies.

import type { InitializeRequest } from "./types.js";

let _clientCapabilities: InitializeRequest["clientCapabilities"] | null = null;

/** Store client capabilities (called by handleInitialize). */
export function setClientCapabilities(caps: InitializeRequest["clientCapabilities"] | null): void {
  _clientCapabilities = caps;
}

/** Retrieve the stored client capabilities. */
export function getClientCapabilities(): InitializeRequest["clientCapabilities"] | null {
  return _clientCapabilities;
}
