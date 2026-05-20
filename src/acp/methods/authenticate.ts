// authenticate handler — pi doesn't require auth, so this is a no-op.
import type { AuthenticateResponse } from "../types.js";

/**
 * Handle the `authenticate` ACP method — no-op since pi doesn't require auth.
 * @param _params - The method parameters (ignored)
 * @returns An empty `AuthenticateResponse`
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleAuthenticate(
  _params: Record<string, unknown> | undefined,
): Promise<AuthenticateResponse> {
  // Pi doesn't require authentication — any methodId is accepted
  return {};
}
