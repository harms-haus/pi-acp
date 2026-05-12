// authenticate handler — pi doesn't require auth, so this is a no-op.
import type { AuthenticateResponse } from "../types.js";

export async function handleAuthenticate(
  _params: Record<string, unknown> | undefined,
): Promise<AuthenticateResponse> {
  // Pi doesn't require authentication — any methodId is accepted
  return {};
}
