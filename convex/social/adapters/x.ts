import { SOCIAL_LIMITS } from "../../../src/shared/socialContracts";
import type { PlatformAdapter } from "./types";
import { clamp, hashtags, str, strings } from "./types";

// OWNER: Thread H+I.
const MAX = SOCIAL_LIMITS.xPostMaxChars;

export const x: PlatformAdapter = {
  platform: "x",
  instructions: [
    "Platform: X (Twitter). Punchy, plain, scannable. No corporate tone.",
    `"post" is ONE standalone post of at most ${MAX} characters including hashtags (aim for 200).`,
    `Optionally add "thread": 2-4 follow-up posts, each at most ${MAX} characters, that add detail. Use [] when one post is enough.`,
    "At most 2 hashtags, inside the post text. No numbering like 1/5.",
  ].join("\n"),
  schemaHint: '{ "post": string, "thread": string[], "hashtags": string[], "mediaSuggestions": string[] }',
  normalize: (raw) => {
    const post = clamp(str(raw.post, 1000), MAX);
    const thread = strings(raw.thread, 4, 1000).map((entry) => clamp(entry, MAX));
    return {
      platform: "x",
      hook: post,
      body: post,
      hashtags: hashtags(raw.hashtags, 2),
      mediaSuggestions: strings(raw.mediaSuggestions, 2),
      thread: thread.length ? thread : undefined,
    };
  },
  contentType: (o) => (o.thread?.length ? "thread" : "text_post"),
  render: (o) => [o.body, ...(o.thread ?? [])].join("\n\n---\n\n"),
};
