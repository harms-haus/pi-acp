// nes/* handlers (UNSTABLE) — start, suggest, close
import { throwAcpError } from "../../utils/error-codes.js";
import type { StartNesResponse, SuggestNesResponse, CloseNesResponse } from "../types.js";

// nes/start (UNSTABLE)
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleNesStart(
  _params: Record<string, unknown> | undefined,
): Promise<StartNesResponse> {
  throwAcpError(-32601, "Method not implemented (UNSTABLE): nes/start");
}

// nes/suggest (UNSTABLE)
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleNesSuggest(
  _params: Record<string, unknown> | undefined,
): Promise<SuggestNesResponse> {
  throwAcpError(-32601, "Method not implemented (UNSTABLE): nes/suggest");
}

// nes/close (UNSTABLE)
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleNesClose(
  _params: Record<string, unknown> | undefined,
): Promise<CloseNesResponse> {
  throwAcpError(-32601, "Method not implemented (UNSTABLE): nes/close");
}
