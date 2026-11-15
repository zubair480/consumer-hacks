import type { PlatformAdapter } from "./types";
import { clamp, hashtags, joinBlocks, str, strings } from "./types";

// OWNER: Thread H+I.
export const threads: PlatformAdapter = {
  platform: "threads",
  instructions: [
    "Platform: Threads. Conversational and friendly, like texting a group of friends. Lowercase-casual is fine.",
    "post: 1-3 short sentences, at most 450 characters, ending with a genuine question that invites replies.",
    "At most 1 hashtag. No hard sell, no 'link in bio'.",
  ].join("\n"),
  schemaHint: '{ "post": string, "hashtags": string[], "mediaSuggestions": string[] }',
  normalize: (raw) => {
    const post = clamp(str(raw.post, 1000), 500);
    return { platform: "threads", hook: post, body: post, hashtags: hashtags(raw.hashtags, 1), mediaSuggestions: strings(raw.mediaSuggestions, 2) };
  },
  contentType: () => "text_post",
  render: (o) => joinBlocks(o.body, o.hashtags.join(" ")),
};
