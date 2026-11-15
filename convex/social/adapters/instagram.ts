import type { PlatformAdapter } from "./types";
import { hashtags, joinBlocks, str, strings } from "./types";

// OWNER: Thread H+I.
export const instagram: PlatformAdapter = {
  platform: "instagram",
  instructions: [
    "Platform: Instagram. Visual, warm, scroll-stopping first line.",
    "hook: the scroll-stopping first line. caption: 2-4 short lines that continue after the hook (do not repeat the hook or the cta). cta: one soft call to action (save / share / tag a friend).",
    "slides: a 3-6 slide carousel, each { title (≤40 chars), body (≤140 chars) }. Slide 1 is the cover.",
    "No emoji. hashtags: at most 3 relevant hashtags (without spaces).",
    "mediaSuggestions: describe the photos or graphics to use for the post.",
  ].join("\n"),
  schemaHint: '{ "hook": string, "caption": string, "cta": string, "slides": [{ "title": string, "body": string }], "hashtags": string[], "mediaSuggestions": string[] }',
  normalize: (raw) => {
    const slides = Array.isArray(raw.slides)
      ? raw.slides
          .map((slide) => {
            const s = (slide ?? {}) as Record<string, unknown>;
            return { title: str(s.title, 60), body: str(s.body, 220) };
          })
          .filter((slide) => slide.title || slide.body)
          .slice(0, 8)
      : [];
    return {
      platform: "instagram",
      hook: str(raw.hook, 200),
      body: str(raw.caption, 2000),
      cta: str(raw.cta, 200) || undefined,
      hashtags: hashtags(raw.hashtags, 12),
      mediaSuggestions: strings(raw.mediaSuggestions, 4),
      slides: slides.length ? slides : undefined,
    };
  },
  contentType: (o) => (o.slides?.length ? "carousel" : "text_post"),
  render: (o) => joinBlocks(o.hook, o.body, o.cta, o.hashtags.join(" ")),
};
