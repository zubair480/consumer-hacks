import type { PlatformOutput, SocialContentType, SocialPlatform } from "../../../src/shared/socialContracts";

// OWNER: Thread H+I. Shared shape every platform adapter implements.

export type BriefFactInput = { label: string; value: string; source: string; quote?: string };

/** Platform-neutral brief the composer hands to every adapter. */
export type ContentBrief = {
  sourceKind: "saved_item" | "media";
  title: string;
  summary?: string;
  url?: string;
  contentType: string;
  /** Verified facts only, each with its source. Creative text may not add new facts. */
  facts: BriefFactInput[];
  /** How the user relates to the source; adapters must not claim more than this. */
  relationship: string;
  userContext?: string;
  tone?: string;
  audience?: string;
};

export type PlatformAdapter = {
  platform: SocialPlatform;
  /** Platform-specific writing rules appended to the shared system prompt. */
  instructions: string;
  /** JSON shape the model returns. */
  schemaHint: string;
  /** Validates and clamps raw model JSON into PlatformOutput. */
  normalize: (raw: Record<string, unknown>) => PlatformOutput;
  contentType: (output: PlatformOutput) => SocialContentType;
  /** Copy-ready text for the share sheet. */
  render: (output: PlatformOutput) => string;
};

export function str(value: unknown, max = 3000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function strings(value: unknown, maxItems: number, maxLen = 300): string[] {
  return Array.isArray(value) ? value.map((entry) => str(entry, maxLen)).filter(Boolean).slice(0, maxItems) : [];
}

export function hashtags(value: unknown, maxItems: number): string[] {
  return strings(value, maxItems, 60)
    .map((tag) => `#${tag.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`)
    .filter((tag) => tag.length > 1);
}

export function joinBlocks(...blocks: (string | undefined | false)[]): string {
  return blocks.filter((block): block is string => Boolean(block && block.trim())).join("\n\n");
}

/** Cuts text to max chars at a word boundary, with an ellipsis. */
export function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
