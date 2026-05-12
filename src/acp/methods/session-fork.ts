// session/fork handler (UNSTABLE)
import { throwAcpError } from "../../utils/error-codes.js";
import type { ForkSessionResponse } from "../types.js";

export async function handleSessionFork(
  _params: Record<string, unknown> | undefined,
): Promise<ForkSessionResponse> {
  throwAcpError(-32601, "Method not implemented (UNSTABLE): session/fork");
}
