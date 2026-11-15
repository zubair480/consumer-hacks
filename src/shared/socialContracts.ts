// OWNER: Thread H+I. Shared Social Studio shapes (Phase 2). Additive only.
// Facts (with evidence) are kept separate from creative text: every draft
// carries provenance[] listing the facts it relied on.

export const SOCIAL_PLATFORMS = ["linkedin", "x", "instagram", "tiktok", "threads"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  threads: "Threads",
};

/** Publishing lifecycle of a draft (J). "published" only on confirmed provider success. */
export const SOCIAL_DRAFT_STATUSES = [
  "draft",
  "ready_to_share",
  "awaiting_user_action",
  "publishing",
  "published",
  "failed",
] as const;
export type SocialDraftStatus = (typeof SOCIAL_DRAFT_STATUSES)[number];

/** Whether the composer has filled in the draft text yet. */
export const GENERATION_STATUSES = ["generating", "ready", "failed"] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

/** Where a revision came from. user_edit revisions are never overwritten. */
export const REVISION_SOURCES = ["generated", "regenerated", "user_edit"] as const;
export type RevisionSource = (typeof REVISION_SOURCES)[number];

export const SOCIAL_CONTENT_TYPES = ["text_post", "thread", "carousel", "video_script"] as const;
export type SocialContentType = (typeof SOCIAL_CONTENT_TYPES)[number];

export const MEDIA_KINDS = ["photo", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const CONNECTION_STATUSES = ["not_connected", "connected", "expired", "error"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const PUBLISHING_OUTCOMES = ["published", "failed", "not_connected", "user_reported_shared"] as const;
export type PublishingOutcome = (typeof PUBLISHING_OUTCOMES)[number];

/** A fact the draft relies on, with where it came from. */
export type BriefFact = {
  label: string;
  value: string;
  /** URL, "user_text", "image", "user_context", or "media_analysis". */
  source: string;
  quote?: string;
};

export type TikTokShot = { visual: string; durationSec?: number };

export type TikTokScript = {
  hook: string;
  shots: TikTokShot[];
  voiceover: string;
  onScreenText: string[];
  caption: string;
};

export type CarouselSlide = { title: string; body: string };

/** Structured adapter output. draftText is the copy-ready flattening of this. */
export type PlatformOutput = {
  platform: SocialPlatform;
  hook: string;
  body: string;
  cta?: string;
  hashtags: string[];
  mediaSuggestions: string[];
  /** X only: each post ≤ 280 chars. */
  thread?: string[];
  /** Instagram carousel. */
  slides?: CarouselSlide[];
  /** TikTok storyboard. */
  script?: TikTokScript;
};

export type MediaReference = {
  mediaId?: string;
  storageId?: string;
  url?: string;
  description: string;
};

/** Analysis written onto a mediaAssets row by the photo thread. */
export type MediaAnalysis = {
  summary: string;
  subjects: string[];
  setting?: string;
  mood?: string;
  textInImage?: string;
};

/** What api.social.drafts.listForSource / get return per draft (latest revision). */
export type SocialDraftView = {
  _id: string;
  platform: SocialPlatform;
  sourceSavedItemId?: string;
  sourceMediaId?: string;
  batchId?: string;
  draftText: string;
  contentType: SocialContentType;
  output?: PlatformOutput;
  provenance: BriefFact[];
  mediaReferences: MediaReference[];
  status: SocialDraftStatus;
  generationStatus: GenerationStatus;
  generationError?: string;
  revision: number;
  revisionSource: RevisionSource;
  createdAt: number;
  updatedAt: number;
};

export type SocialDraftRevisionView = {
  _id: string;
  revision: number;
  source: RevisionSource;
  draftText: string;
  output?: PlatformOutput;
  createdAt: number;
};

export type PlatformRecommendation = { platform: SocialPlatform; reason: string; recommended: boolean };

export const SOCIAL_LIMITS = {
  xPostMaxChars: 280,
  draftTextMaxChars: 10000,
  contextMaxChars: 2000,
} as const;
