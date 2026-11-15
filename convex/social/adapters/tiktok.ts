import type { PlatformAdapter } from "./types";
import { hashtags, joinBlocks, str, strings } from "./types";

// OWNER: Thread H+I.
export const tiktok: PlatformAdapter = {
  platform: "tiktok",
  instructions: [
    "Platform: TikTok. A 15-40 second vertical video plan, casual and energetic, spoken in first person.",
    "hook: what is said/shown in the first 2 seconds.",
    "shots: 4-7 shots, each { visual (what the camera shows), durationSec }. Only shots the user can actually film or source; never stage experiences they have not had.",
    "voiceover: the full spoken script. onScreenText: 3-6 short text overlays. caption: ≤150 chars.",
    "hashtags: 3-6.",
  ].join("\n"),
  schemaHint: '{ "hook": string, "shots": [{ "visual": string, "durationSec": number }], "voiceover": string, "onScreenText": string[], "caption": string, "hashtags": string[], "mediaSuggestions": string[] }',
  normalize: (raw) => {
    const shots = Array.isArray(raw.shots)
      ? raw.shots
          .map((shot) => {
            const s = (shot ?? {}) as Record<string, unknown>;
            const duration = typeof s.durationSec === "number" && s.durationSec > 0 ? Math.min(s.durationSec, 30) : undefined;
            return { visual: str(s.visual, 300), durationSec: duration };
          })
          .filter((shot) => shot.visual)
          .slice(0, 10)
      : [];
    const script = {
      hook: str(raw.hook, 200),
      shots,
      voiceover: str(raw.voiceover, 2000),
      onScreenText: strings(raw.onScreenText, 8, 80),
      caption: str(raw.caption, 300),
    };
    return {
      platform: "tiktok",
      hook: script.hook,
      body: script.caption,
      hashtags: hashtags(raw.hashtags, 6),
      mediaSuggestions: strings(raw.mediaSuggestions, 4),
      script,
    };
  },
  contentType: () => "video_script",
  render: (o) => {
    const s = o.script;
    if (!s) return joinBlocks(o.body, o.hashtags.join(" "));
    return joinBlocks(
      `Hook: ${s.hook}`,
      `Shots:\n${s.shots.map((shot, i) => `${i + 1}. ${shot.visual}${shot.durationSec ? ` (${shot.durationSec}s)` : ""}`).join("\n")}`,
      `Voiceover:\n${s.voiceover}`,
      s.onScreenText.length > 0 && `On-screen text:\n${s.onScreenText.map((t) => `• ${t}`).join("\n")}`,
      `Caption: ${joinBlocks(s.caption, o.hashtags.join(" ")).replace("\n\n", " ")}`,
    );
  },
};
