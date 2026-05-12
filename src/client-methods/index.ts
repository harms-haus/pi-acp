// Client-side method implementations — barrel exports
export { handleFsReadTextFile, handleFsWriteTextFile } from "./filesystem.js";
export {
  handleTerminalCreate,
  handleTerminalOutput,
  handleTerminalWaitForExit,
  handleTerminalRelease,
  handleTerminalKill,
} from "./terminal.js";
