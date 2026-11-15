import type { PlatformAdapter } from "./types";
import { hashtags, joinBlocks, str, strings } from "./types";

// OWNER: Thread H+I.
export const linkedin: PlatformAdapter = {
  platform: "linkedin",
  instructions: [
    "Platform: LinkedIn. Professional, first-person, insight-led.",
    "Structure: a one-line hook, 2-4 short paragraphs on why it matters, a concrete takeaway, and a closing question or call to action.",
    "hook, body, takeaway and cta are separate fields and must not repeat each other. 120-220 words in total. Line breaks between paragraphs. At most 3 hashtags at the end. No emoji walls.",
  ].join("\n"),
  schemaHint: '{ "hook": string, "body": string, "takeaway": string, "cta": string, "hashtags": string[], "mediaSuggestions": string[] }',
  normalize: (raw) => ({
    platform: "linkedin",
    hook: str(raw.hook, 200),
    body: joinBlocks(str(raw.body), str(raw.takeaway) && `Takeaway: ${str(raw.takeaway, 400)}`),
    cta: str(raw.cta, 300) || undefined,
    hashtags: hashtags(raw.hashtags, 3),
    mediaSuggestions: strings(raw.mediaSuggestions, 3),
  }),
  contentType: () => "text_post",
  render: (o) => joinBlocks(o.hook, o.body, o.cta, o.hashtags.join(" ")),
};
