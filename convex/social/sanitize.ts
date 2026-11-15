import type { SocialPlatform } from "../../src/shared/socialContracts";

const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}\uFE0E\uFE0F\u200D\u20E3]/gu;
const HASHTAG = /(^|[^\p{L}\p{N}_&#/])#[\p{L}\p{N}_]+/gu;

export function maxHashtags(platform: SocialPlatform): number {
  return platform === "instagram" || platform === "tiktok" ? 3 : 0;
}

export function stripEmoji(text: string): string {
  return text.replace(EMOJI, "");
}

export function capHashtagList(tags: string[], platform: SocialPlatform): string[] {
  return tags.map((tag) => stripEmoji(tag).trim()).filter(Boolean).slice(0, maxHashtags(platform));
}

/** Removes emoji, keeps the first N hashtags for the platform, and tidies leftover whitespace. */
export function sanitizeDraftText(text: string, platform: SocialPlatform): string {
  let kept = 0;
  const limit = maxHashtags(platform);
  return stripEmoji(text)
    .replace(HASHTAG, (match, lead: string) => (kept++ < limit ? match : lead))
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+([.,!?;:])/g, "$1").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
