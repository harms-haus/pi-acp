// providers/* handlers (UNSTABLE) — list, set, disable
import { throwAcpError } from "../../utils/error-codes.js";
import type {
  ListProvidersResponse,
  SetProvidersResponse,
  DisableProvidersResponse,
} from "../types.js";

// providers/list (UNSTABLE)
export async function handleProvidersList(
  _params: Record<string, unknown> | undefined,
): Promise<ListProvidersResponse> {
  return Promise.resolve({ providers: [] });
}

// providers/set (UNSTABLE)
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleProvidersSet(
  _params: Record<string, unknown> | undefined,
): Promise<SetProvidersResponse> {
  throwAcpError(-32601, "Method not implemented (UNSTABLE): providers/set");
}

// providers/disable (UNSTABLE)
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleProvidersDisable(
  _params: Record<string, unknown> | undefined,
): Promise<DisableProvidersResponse> {
  throwAcpError(-32601, "Method not implemented (UNSTABLE): providers/disable");
}
