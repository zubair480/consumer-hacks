import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

export const STUDIO_PLATFORMS = ["linkedin", "x", "instagram", "tiktok", "threads"] as const;
export type StudioPlatform = (typeof STUDIO_PLATFORMS)[number];

type Meta = { label: string; icon: ComponentProps<typeof Ionicons>["name"]; color: string; limit: number; blurb: string };

export const PLATFORM_META: Record<StudioPlatform, Meta> = {
  linkedin: { label: "LinkedIn", icon: "logo-linkedin", color: "#0A66C2", limit: 3000, blurb: "Professional takeaway" },
  x: { label: "X", icon: "logo-x", color: "#E7E9EA", limit: 280, blurb: "Short and punchy" },
  instagram: { label: "Instagram", icon: "logo-instagram", color: "#E1306C", limit: 2200, blurb: "Caption + hashtags" },
  tiktok: { label: "TikTok", icon: "logo-tiktok", color: "#25F4EE", limit: 2200, blurb: "Video script" },
  threads: { label: "Threads", icon: "logo-threads", color: "#C9C9D6", limit: 500, blurb: "Conversational" },
};

export function platformMeta(platform: string): Meta {
  return PLATFORM_META[platform as StudioPlatform] ?? { label: platform, icon: "share-social", color: "#A0A0B4", limit: 2000, blurb: "" };
}
