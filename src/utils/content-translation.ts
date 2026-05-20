/**
 * Translate between pi SDK content formats and ACP ContentBlock formats.
 *
 * Provides bidirectional conversion for text, image, audio, and resource content,
 * as well as tool-name-to-ToolKind mapping and human-readable title generation.
 * @module content-translation
 */

import {
  toSdkToolKind,
  type ContentBlock,
  type ToolCallContent,
  type ToolKind,
} from "../acp/types.js";

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

/**
 * Map a pi tool name to the corresponding ACP `ToolKind`.
 * Unknown tools map to `"other"`. The value is further normalised by `toSdkToolKind`.
 * @param toolName - The internal pi tool name (e.g. `"read"`, `"bash"`)
 * @returns The ACP `ToolKind` string
 */
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

/**
 * Build a human-readable title for a tool call, appending the file path or command when available.
 * @param kind - The ACP `ToolKind`
 * @param input - Optional tool input; if it has a `path` or `command` property it is included in the title
 * @returns A descriptive string like `"read: /src/index.ts"` or just the `kind`
 */
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

/** Convert a single content item (from an array) to ContentBlock(s). */
function convertContentItem(item: unknown): ContentBlock[] {
  if (typeof item === "string") return [{ type: "text", text: item }];
  if (item === null || item === undefined || typeof item !== "object") return [];
  const block = item as Record<string, unknown>;
  switch (block.type) {
    case "text":
      return [{ type: "text", text: typeof block.text === "string" ? block.text : "" }];
    case "image": {
      const src = block.source as Record<string, unknown> | undefined;
      if (!src) return [];
      return [
        {
          type: "image",
          data: typeof src.data === "string" ? src.data : "",
          mimeType: typeof src.mediaType === "string" ? src.mediaType : "image/png",
        },
      ];
    }
    case "thinking":
      return [{ type: "text", text: typeof block.thinking === "string" ? block.thinking : "" }];
    default:
      return [{ type: "text", text: JSON.stringify(item) }];
  }
}

/**
 * Convert pi message content to an array of ACP `ContentBlock` objects.
 * Handles strings, arrays of pi content items (text, image, thinking), and falls back to JSON.
 * @param content - The pi SDK message content (string, array, or unknown)
 * @returns An array of ACP `ContentBlock` objects
 */
export function piContentToAcpBlocks(content: unknown): ContentBlock[] {
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (Array.isArray(content)) {
    const results: ContentBlock[] = [];
    for (const item of content) {
      results.push(...convertContentItem(item));
    }
    return results;
  }
  return [{ type: "text", text: "" }];
}

/**
 * Convert ACP `ContentBlock[]` back to a pi-compatible prompt format.
 * Returns a plain string when the result is a single text block, otherwise an array of pi content objects.
 * @param blocks - The ACP `ContentBlock` array from the client
 * @returns A string (single text) or an array of pi content objects
 */
export function acpBlocksToPiContent(
  blocks: ContentBlock[],
):
  | string
  | (
      | { type: string; text?: string }
      | { type: string; source: { type: string; mediaType: string; data: string } }
    )[] {
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
  return result as (
    | { type: string; text?: string }
    | { type: string; source: { type: string; mediaType: string; data: string } }
  )[];
}

/**
 * Convert a pi tool result to ACP `ToolCallContent[]`, including diff blocks for edit operations.
 * @param toolName - The pi tool name (used to decide whether to emit diff content)
 * @param content - The tool result content
 * @param details - Optional metadata; for `"edit"` tools, `path`, `newText`, and `oldText` are extracted
 * @returns An array of `ToolCallContent` objects (content blocks and optional diff)
 */
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
