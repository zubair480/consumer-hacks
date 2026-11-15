import { v, type VLiteral, type VUnion } from "convex/values";
import {
  CONNECTION_STATUSES,
  GENERATION_STATUSES,
  MEDIA_KINDS,
  PUBLISHING_OUTCOMES,
  REVISION_SOURCES,
  SOCIAL_CONTENT_TYPES,
  SOCIAL_DRAFT_STATUSES,
  SOCIAL_PLATFORMS,
} from "../../src/shared/socialContracts";

// OWNER: Thread H+I. Validators derived from src/shared/socialContracts.ts.

function literals<const T extends readonly [string, string, ...string[]]>(values: T) {
  const [a, b, ...rest] = values.map((value) => v.literal(value));
  return v.union(a, b, ...rest) as unknown as VUnion<T[number], VLiteral<T[number], "required">[], "required", never>;
}

export const vSocialPlatform = literals(SOCIAL_PLATFORMS);
export const vSocialDraftStatus = literals(SOCIAL_DRAFT_STATUSES);
export const vGenerationStatus = literals(GENERATION_STATUSES);
export const vRevisionSource = literals(REVISION_SOURCES);
export const vSocialContentType = literals(SOCIAL_CONTENT_TYPES);
export const vMediaKind = literals(MEDIA_KINDS);
export const vConnectionStatus = literals(CONNECTION_STATUSES);
export const vPublishingOutcome = literals(PUBLISHING_OUTCOMES);

export const vBriefFact = v.object({
  label: v.string(),
  value: v.string(),
  source: v.string(),
  quote: v.optional(v.string()),
});

export const vPlatformOutput = v.object({
  platform: vSocialPlatform,
  hook: v.string(),
  body: v.string(),
  cta: v.optional(v.string()),
  hashtags: v.array(v.string()),
  mediaSuggestions: v.array(v.string()),
  thread: v.optional(v.array(v.string())),
  slides: v.optional(v.array(v.object({ title: v.string(), body: v.string() }))),
  script: v.optional(
    v.object({
      hook: v.string(),
      shots: v.array(v.object({ visual: v.string(), durationSec: v.optional(v.number()) })),
      voiceover: v.string(),
      onScreenText: v.array(v.string()),
      caption: v.string(),
    }),
  ),
});

export const vMediaReference = v.object({
  mediaId: v.optional(v.id("mediaAssets")),
  storageId: v.optional(v.id("_storage")),
  url: v.optional(v.string()),
  description: v.string(),
});

export const vMediaAnalysis = v.object({
  summary: v.string(),
  subjects: v.array(v.string()),
  setting: v.optional(v.string()),
  mood: v.optional(v.string()),
  textInImage: v.optional(v.string()),
});
