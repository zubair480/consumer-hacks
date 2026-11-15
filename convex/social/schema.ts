import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vBriefFact,
  vConnectionStatus,
  vGenerationStatus,
  vMediaAnalysis,
  vMediaKind,
  vMediaReference,
  vPlatformOutput,
  vPublishingOutcome,
  vRevisionSource,
  vSocialContentType,
  vSocialDraftStatus,
  vSocialPlatform,
} from "./validators";

// OWNER: Thread H+I. Phase 2 (Social Studio) tables, spread into convex/schema.ts.
// No tokens or secrets in any of these rows.
export const socialTables = {
  mediaAssets: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    kind: vMediaKind,
    context: v.optional(v.string()),
    analysis: v.optional(vMediaAnalysis),
    createdAt: v.number(),
  }).index("by_userId_and_createdAt", ["userId", "createdAt"]),

  socialDrafts: defineTable({
    userId: v.id("users"),
    sourceSavedItemId: v.optional(v.id("savedItems")),
    sourceMediaId: v.optional(v.id("mediaAssets")),
    batchId: v.optional(v.string()),
    platform: vSocialPlatform,
    draftText: v.string(),
    contentType: vSocialContentType,
    output: v.optional(vPlatformOutput),
    provenance: v.array(vBriefFact),
    mediaReferences: v.array(vMediaReference),
    status: vSocialDraftStatus,
    generationStatus: vGenerationStatus,
    generationError: v.optional(v.string()),
    revision: v.number(),
    revisionSource: vRevisionSource,
    context: v.optional(v.string()),
    tone: v.optional(v.string()),
    audience: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_sourceSavedItemId", ["userId", "sourceSavedItemId"])
    .index("by_userId_and_sourceMediaId", ["userId", "sourceMediaId"])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"]),

  socialDraftRevisions: defineTable({
    userId: v.id("users"),
    draftId: v.id("socialDrafts"),
    revision: v.number(),
    source: vRevisionSource,
    draftText: v.string(),
    output: v.optional(vPlatformOutput),
    createdAt: v.number(),
  }).index("by_draftId_and_revision", ["draftId", "revision"]),

  platformConnections: defineTable({
    userId: v.id("users"),
    platform: vSocialPlatform,
    connectionStatus: vConnectionStatus,
    providerAccountId: v.optional(v.string()),
    grantedScopes: v.array(v.string()),
    updatedAt: v.number(),
  }).index("by_userId_and_platform", ["userId", "platform"]),

  publishingJobs: defineTable({
    userId: v.id("users"),
    draftId: v.id("socialDrafts"),
    platform: vSocialPlatform,
    status: vSocialDraftStatus,
    idempotencyKey: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    externalPostId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_draftId", ["draftId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),

  publishingResults: defineTable({
    userId: v.id("users"),
    jobId: v.id("publishingJobs"),
    draftId: v.id("socialDrafts"),
    platform: vSocialPlatform,
    outcome: vPublishingOutcome,
    externalPostId: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_draftId", ["draftId"]),
};
