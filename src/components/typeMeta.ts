import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { ContentType } from "../shared/contracts";

type IconName = ComponentProps<typeof Ionicons>["name"];

export const typeMeta: Record<ContentType, { label: string; icon: IconName; color: string }> = {
  restaurant: { label: "Restaurant", icon: "restaurant", color: "#F97316" },
  github_repository: { label: "GitHub", icon: "logo-github", color: "#A3A3FF" },
  code_snippet: { label: "Code", icon: "code-slash", color: "#22D3EE" },
  scholarship: { label: "Scholarship", icon: "school", color: "#FBBF24" },
  job: { label: "Job", icon: "briefcase", color: "#34D399" },
  application: { label: "Application", icon: "document-text", color: "#60A5FA" },
  graphic: { label: "Design", icon: "color-palette", color: "#EC4899" },
  recipe: { label: "Recipe", icon: "nutrition", color: "#84CC16" },
  event: { label: "Event", icon: "calendar", color: "#F472B6" },
  travel: { label: "Travel", icon: "airplane", color: "#38BDF8" },
  product: { label: "Product", icon: "pricetag", color: "#FB7185" },
  research: { label: "Research", icon: "flask", color: "#C084FC" },
  tutorial: { label: "Tutorial", icon: "play-circle", color: "#2DD4BF" },
  general_content: { label: "Saved", icon: "bookmark", color: "#A0A0B4" },
};

export const metaFor = (type?: ContentType) => typeMeta[type ?? "general_content"] ?? typeMeta.general_content;

export function timeAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
