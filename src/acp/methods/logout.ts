// logout handler (UNSTABLE)
import { throwAcpError } from "../../utils/error-codes.js";
import type { LogoutResponse } from "../types.js";

export async function handleLogout(
  _params: Record<string, unknown> | undefined,
): Promise<LogoutResponse> {
  throwAcpError(-32601, "Method not implemented (UNSTABLE): logout");
}
