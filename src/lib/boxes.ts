import type { ContentType } from "../shared/contracts";
import { palette } from "../theme";

export type BoxKey = "code" | "forms" | "events" | "jobs" | "learn" | "other";

/** Demo-flow boxes: every save lands in one by its primary type. */
export const BOXES: { key: BoxKey; label: string; color: string; types: ContentType[]; action?: string }[] = [
  { key: "code", label: "Code", color: palette.cyan, types: ["github_repository", "code_snippet"], action: "Run it for me" },
  { key: "forms", label: "Forms", color: palette.mint, types: ["application", "scholarship"], action: "Fill it for me" },
  { key: "events", label: "Events", color: palette.lavender, types: ["event"], action: "Add to my calendar" },
  { key: "jobs", label: "Jobs", color: palette.butter, types: ["job"] },
  { key: "learn", label: "Learn", color: palette.peach, types: ["tutorial", "research"] },
  { key: "other", label: "Other", color: palette.lime, types: [] },
];

export const boxFor = (type?: ContentType) => BOXES.find((b) => type && b.types.includes(type)) ?? BOXES[BOXES.length - 1];
