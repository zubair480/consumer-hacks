import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import { palette } from "../../theme";

export const STUDIO_PLATFORMS = ["linkedin", "x", "instagram", "tiktok", "threads"] as const;
export type StudioPlatform = (typeof STUDIO_PLATFORMS)[number];

type Meta = { label: string; icon: ComponentProps<typeof Ionicons>["name"]; color: string; fg: string; limit: number; blurb: string };

export const PLATFORM_META: Record<StudioPlatform, Meta> = {
  linkedin: { label: "LinkedIn", icon: "logo-linkedin", color: palette.lavender, fg: palette.ink, limit: 3000, blurb: "Professional takeaway" },
  x: { label: "X", icon: "logo-x", color: palette.ink, fg: palette.white, limit: 280, blurb: "Short and punchy" },
  instagram: { label: "Instagram", icon: "logo-instagram", color: palette.peach, fg: palette.ink, limit: 2200, blurb: "Caption and a few hashtags" },
  tiktok: { label: "TikTok", icon: "logo-tiktok", color: palette.mint, fg: palette.ink, limit: 2200, blurb: "Video script" },
  threads: { label: "Threads", icon: "logo-threads", color: palette.cyan, fg: palette.ink, limit: 500, blurb: "Conversational" },
};

export function platformMeta(platform: string): Meta {
  return PLATFORM_META[platform as StudioPlatform] ?? { label: platform, icon: "share-social", color: palette.paper, fg: palette.ink, limit: 2000, blurb: "" };
}
