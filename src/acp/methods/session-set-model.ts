// session/set_model handler (UNSTABLE)
import { throwAcpError } from "../../utils/error-codes.js";
import type { SetSessionModelResponse } from "../types.js";

export async function handleSessionSetModel(
  _params: Record<string, unknown> | undefined,
): Promise<SetSessionModelResponse> {
  throwAcpError(-32601, "Method not implemented (UNSTABLE): session/set_model");
}
