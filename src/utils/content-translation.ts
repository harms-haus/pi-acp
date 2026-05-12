// Translate between pi SDK content formats and ACP ContentBlock formats.
import { toSdkToolKind, type ContentBlock, type ToolCallContent, type ToolKind } from "../acp/types.js";

/**
 * Interface for tool input with a path property.
 */
interface ToolInputWithPath {
  path: unknown;
  [key: string]: unknown;
}

/**
 * Interface for tool input with a command property.
 */
interface ToolInputWithCommand {
  command: unknown;
  [key: string]: unknown;
}

/**
 * Type guard to check if input has a path property.
 */
function hasPath(input: unknown): input is ToolInputWithPath {
  return typeof input === "object" && input !== null && "path" in input;
}

/**
 * Type guard to check if input has a command property.
 */
function hasCommand(input: unknown): input is ToolInputWithCommand {
  return typeof input === "object" && input !== null && "command" in input;
}

/** Map pi tool name to ACP ToolKind. */
export function toolNameToKind(toolName: string): ToolKind {
  let kind: string;
  switch (toolName) {
    case "read":
      kind = "read";
      break;
    case "edit":
      kind = "edit";
      break;
    case "write":
      kind = "create";
      break;
    case "bash":
      kind = "execute";
      break;
    case "grep":
      kind = "search";
      break;
    case "find":
      kind = "search";
      break;
    case "ls":
      kind = "search";
      break;
    default:
      kind = "other";
      break;
  }
  // Map "create" to "other" for SDK compatibility
  return toSdkToolKind(kind) as ToolKind;
}

/** Map ACP ToolKind to human-readable title. */
export function kindToTitle(kind: string, input?: unknown): string {
  if (hasPath(input)) {
    return `${kind}: ${String(input.path)}`;
  }
  if (hasCommand(input)) {
    const cmd = String(input.command).split("\n")[0].slice(0, 80);
    return `${kind}: ${cmd}`;
  }
  return kind;
}

/** Convert pi message content to ACP ContentBlock[]. */
export function piContentToAcpBlocks(content: unknown): ContentBlock[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (Array.isArray(content)) {
    const results: ContentBlock[] = [];
    for (const item of content) {
      if (typeof item === "string") {
        results.push({ type: "text", text: item });
        continue;
      }
      if (item === null || item === undefined || typeof item !== "object") continue;
      const block = item as Record<string, unknown>;
      switch (block.type) {
        case "text":
          results.push({ type: "text", text: typeof block.text === "string" ? block.text : "" });
          break;
        case "image": {
          const src = block.source as Record<string, unknown> | undefined;
          if (!src) break;
          results.push({
            type: "image",
            data: typeof src.data === "string" ? src.data : "",
            mimeType: typeof src.mediaType === "string" ? src.mediaType : "image/png",
          });
          break;
        }
        case "thinking":
          results.push({ type: "text", text: typeof block.thinking === "string" ? block.thinking : "" });
          break;
        default:
          results.push({ type: "text", text: JSON.stringify(item) });
          break;
      }
    }
    return results;
  }
  return [{ type: "text", text: typeof content === "string" ? content : "" }];
}

/** Convert ACP ContentBlock[] to pi prompt string or content array. */
export function acpBlocksToPiContent(
  blocks: ContentBlock[],
): string | ({ type: string; text?: string } | { type: string; source: { type: string; mediaType: string; data: string } })[] {
  const result: Record<string, unknown>[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        result.push({ type: "text", text: block.text });
        break;
      case "image":
        result.push({
          type: "image",
          source: { type: "base64", mediaType: block.mimeType, data: block.data },
        });
        break;
      case "audio":
        // pi doesn't support audio natively — include as text reference
        result.push({ type: "text", text: `[audio: ${block.mimeType}]` });
        break;
      case "resource_link":
        result.push({ type: "text", text: `Resource: ${block.uri} (${block.name})` });
        break;
      case "resource": {
        const res = block.resource as unknown as Record<string, unknown>;
        if ("text" in res) {
          result.push({ type: "text", text: String(res.text) });
        } else if ("blob" in res) {
          result.push({ type: "text", text: `[binary resource: ${String(res.uri)}]` });
        }
        break;
      }
    }
  }
  // If only one text block, return as plain string
  if (result.length === 1 && result[0].type === "text") {
    return result[0].text as string;
  }
  return result as ({ type: string; text?: string } | { type: string; source: { type: string; mediaType: string; data: string } })[];
}

/** Convert pi tool result to ACP ToolCallContent[]. */
export function piToolResultToAcpContent(
  toolName: string,
  content: unknown,
  details?: Record<string, unknown>,
): ToolCallContent[] {
  const blocks = piContentToAcpBlocks(content);
  const result: ToolCallContent[] = blocks.map((c) => ({ type: "content", content: c }));
  // If tool is "edit" and details contain path changes, emit diff content
  if (toolName === "edit" && details && typeof details === "object") {
    const d = details;
    if (typeof d.path === "string" && typeof d.newText === "string") {
      result.push({
        type: "diff",
        path: d.path,
        newText: d.newText,
        oldText: typeof d.oldText === "string" ? d.oldText : undefined,
      });
    }
  }
  return result;
}
