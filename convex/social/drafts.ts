import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { ContentType } from "../../src/shared/contracts";
import {
  SOCIAL_LIMITS,
  SOCIAL_PLATFORMS,
  type PlatformRecommendation,
  type SocialDraftRevisionView,
  type SocialDraftView,
  type SocialPlatform,
} from "../../src/shared/socialContracts";
import { requireOwned, requireUser } from "../lib/auth";
import { vOwnerId } from "../lib/validators";
import { vPlatformOutput, vSocialPlatform } from "./validators";

// OWNER: Thread H+I. Public Social Studio draft API. Every function takes
// ownerId and checks ownership. Generation runs in internal.social.composer.run;
// regenerating one draft never touches another draft or rewrites a revision.

function toView(draft: Doc<"socialDrafts">): SocialDraftView {
  const { userId: _userId, _creationTime: _ct, context: _c, tone: _t, audience: _a, ...rest } = draft;
  return rest;
}

async function requireSource(
  ctx: QueryCtx,
  user: Doc<"users">,
  itemId: Id<"savedItems"> | undefined,
  mediaId: Id<"mediaAssets"> | undefined,
) {
  if (!itemId === !mediaId) throw new ConvexError("Pass exactly one of itemId or mediaId");
  if (itemId) return { item: await requireOwned(ctx, user, itemId), media: null };
  return { item: null, media: await requireOwned(ctx, user, mediaId!) };
}

async function draftsForSource(
  ctx: QueryCtx,
  userId: Id<"users">,
  itemId: Id<"savedItems"> | undefined,
  mediaId: Id<"mediaAssets"> | undefined,
) {
  return itemId
    ? await ctx.db
        .query("socialDrafts")
        .withIndex("by_userId_and_sourceSavedItemId", (q) => q.eq("userId", userId).eq("sourceSavedItemId", itemId))
        .take(200)
    : await ctx.db
        .query("socialDrafts")
        .withIndex("by_userId_and_sourceMediaId", (q) => q.eq("userId", userId).eq("sourceMediaId", mediaId))
        .take(200);
}

async function startGeneration(ctx: MutationCtx, draftId: Id<"socialDrafts">, mode: "generated" | "regenerated") {
  await ctx.scheduler.runAfter(0, internal.social.composer.run, { draftId, mode });
}

/**
 * Creates one draft per platform (generationStatus "generating") for a saved
 * item or a media asset and schedules the composer for each. Returns the batch.
 */
export const generate = mutation({
  args: {
    ownerId: vOwnerId,
    itemId: v.optional(v.id("savedItems")),
    mediaId: v.optional(v.id("mediaAssets")),
    platforms: v.array(vSocialPlatform),
    context: v.optional(v.string()),
    tone: v.optional(v.string()),
    audience: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.ownerId);
    await requireSource(ctx, user, args.itemId, args.mediaId);
    const platforms = [...new Set(args.platforms)];
    if (platforms.length === 0) throw new ConvexError("Pick at least one platform");
    if ((args.context?.length ?? 0) > SOCIAL_LIMITS.contextMaxChars) throw new ConvexError("Context is too long");
    const now = Date.now();
    const batchId = `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const draftIds: Id<"socialDrafts">[] = [];
    for (const platform of platforms) {
      const draftId = await ctx.db.insert("socialDrafts", {
        userId: user._id,
        sourceSavedItemId: args.itemId,
        sourceMediaId: args.mediaId,
        batchId,
        platform,
        draftText: "",
        contentType: "text_post",
        provenance: [],
        mediaReferences: [],
        status: "draft",
        generationStatus: "generating",
        revision: 0,
        revisionSource: "generated",
        context: args.context?.trim() || undefined,
        tone: args.tone?.trim() || undefined,
        audience: args.audience?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });
      await startGeneration(ctx, draftId, "generated");
      draftIds.push(draftId);
    }
    return { batchId, draftIds };
  },
});

/** Latest draft per platform for a source, in SOCIAL_PLATFORMS order. */
export const listForSource = query({
  args: { ownerId: vOwnerId, itemId: v.optional(v.id("savedItems")), mediaId: v.optional(v.id("mediaAssets")) },
  handler: async (ctx, { ownerId, itemId, mediaId }): Promise<SocialDraftView[]> => {
    const user = await requireUser(ctx, ownerId);
    await requireSource(ctx, user, itemId, mediaId);
    const latest = new Map<SocialPlatform, Doc<"socialDrafts">>();
    for (const draft of await draftsForSource(ctx, user._id, itemId, mediaId)) {
      const current = latest.get(draft.platform);
      if (!current || draft.createdAt > current.createdAt) latest.set(draft.platform, draft);
    }
    return SOCIAL_PLATFORMS.flatMap((platform) => {
      const draft = latest.get(platform);
      return draft ? [toView(draft)] : [];
    });
  },
});

/** The user's drafts across all sources, newest updatedAt first (max 50). */
export const listRecent = query({
  args: { ownerId: vOwnerId, limit: v.optional(v.number()) },
  handler: async (ctx, { ownerId, limit }): Promise<SocialDraftView[]> => {
    const user = await requireUser(ctx, ownerId);
    const drafts = await ctx.db
      .query("socialDrafts")
      .withIndex("by_userId_and_updatedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(Math.max(1, Math.min(Math.floor(limit ?? 20), 50)));
    return drafts.map(toView);
  },
});

/** One draft with its revision history, newest first. */
export const get = query({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts") },
  handler: async (ctx, { ownerId, draftId }): Promise<SocialDraftView & { revisions: SocialDraftRevisionView[] }> => {
    const user = await requireUser(ctx, ownerId);
    const draft = await requireOwned(ctx, user, draftId);
    const revisions = await ctx.db
      .query("socialDraftRevisions")
      .withIndex("by_draftId_and_revision", (q) => q.eq("draftId", draftId))
      .order("desc")
      .take(50);
    return {
      ...toView(draft),
      revisions: revisions.map(({ _id, revision, source, draftText, output, createdAt }) => ({
        _id,
        revision,
        source,
        draftText,
        output,
        createdAt,
      })),
    };
  },
});

/** Saves a user edit as a new revision (source "user_edit"). Optionally marks it ready to share. */
export const update = mutation({
  args: {
    ownerId: vOwnerId,
    draftId: v.id("socialDrafts"),
    draftText: v.string(),
    output: v.optional(vPlatformOutput),
    markReady: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.ownerId);
    const draft = await requireOwned(ctx, user, args.draftId);
    if (draft.generationStatus === "generating") throw new ConvexError("This draft is still generating");
    const draftText = args.draftText.trim();
    if (!draftText) throw new ConvexError("Draft text can't be empty");
    if (draftText.length > SOCIAL_LIMITS.draftTextMaxChars) throw new ConvexError("Draft text is too long");
    if (args.output && args.output.platform !== draft.platform) throw new ConvexError("Output platform mismatch");
    const now = Date.now();
    const revision = draft.revision + 1;
    const output = args.output ?? draft.output;
    await ctx.db.insert("socialDraftRevisions", {
      userId: user._id,
      draftId: draft._id,
      revision,
      source: "user_edit",
      draftText,
      output,
      createdAt: now,
    });
    await ctx.db.patch(draft._id, {
      draftText,
      output,
      revision,
      revisionSource: "user_edit",
      status: args.markReady ? "ready_to_share" : draft.status === "published" ? draft.status : "draft",
      updatedAt: now,
    });
    return { revision };
  },
});

/**
 * Regenerates this one draft's platform. The result is a new revision on this
 * draft only; earlier revisions (including user edits) stay in history.
 */
export const regenerate = mutation({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts") },
  handler: async (ctx, { ownerId, draftId }) => {
    const user = await requireUser(ctx, ownerId);
    const draft = await requireOwned(ctx, user, draftId);
    if (draft.generationStatus === "generating") return null;
    await ctx.db.patch(draftId, { generationStatus: "generating", generationError: undefined, updatedAt: Date.now() });
    await startGeneration(ctx, draftId, "regenerated");
    return null;
  },
});

/** Makes an earlier revision current again by copying it into a new user_edit revision. */
export const restoreRevision = mutation({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts"), revision: v.number() },
  handler: async (ctx, { ownerId, draftId, revision }) => {
    const user = await requireUser(ctx, ownerId);
    const draft = await requireOwned(ctx, user, draftId);
    if (draft.generationStatus === "generating") throw new ConvexError("This draft is still generating");
    const old = await ctx.db
      .query("socialDraftRevisions")
      .withIndex("by_draftId_and_revision", (q) => q.eq("draftId", draftId).eq("revision", revision))
      .unique();
    if (!old) throw new ConvexError("Revision not found");
    const now = Date.now();
    const next = draft.revision + 1;
    await ctx.db.insert("socialDraftRevisions", {
      userId: user._id,
      draftId,
      revision: next,
      source: "user_edit",
      draftText: old.draftText,
      output: old.output,
      createdAt: now,
    });
    await ctx.db.patch(draftId, { draftText: old.draftText, output: old.output, revision: next, revisionSource: "user_edit", updatedAt: now });
    return { revision: next };
  },
});

const RECOMMENDED_BY_TYPE: Partial<Record<ContentType, SocialPlatform[]>> = {
  github_repository: ["linkedin", "x", "threads"],
  code_snippet: ["x", "linkedin", "threads"],
  tutorial: ["linkedin", "x", "tiktok"],
  research: ["linkedin", "x", "threads"],
  job: ["linkedin", "x"],
  scholarship: ["linkedin", "x", "instagram"],
  application: ["linkedin", "x"],
  restaurant: ["instagram", "tiktok", "threads"],
  recipe: ["instagram", "tiktok", "threads"],
  travel: ["instagram", "tiktok", "threads"],
  graphic: ["instagram", "threads", "x"],
  event: ["instagram", "linkedin", "x"],
  product: ["instagram", "tiktok", "x"],
};

const PLATFORM_REASONS: Record<SocialPlatform, string> = {
  linkedin: "Professional takeaway for your network",
  x: "Short, punchy post or thread",
  instagram: "Visual caption or carousel",
  tiktok: "Short video storyboard",
  threads: "Casual, conversational post",
};

/** Platforms that fit a source, recommended ones first. */
export const recommendPlatforms = query({
  args: { ownerId: vOwnerId, itemId: v.optional(v.id("savedItems")), mediaId: v.optional(v.id("mediaAssets")) },
  handler: async (ctx, { ownerId, itemId, mediaId }): Promise<PlatformRecommendation[]> => {
    const user = await requireUser(ctx, ownerId);
    const { item, media } = await requireSource(ctx, user, itemId, mediaId);
    const recommended = media
      ? media.kind === "video"
        ? ["tiktok", "instagram", "threads"]
        : ["instagram", "tiktok", "threads"]
      : (RECOMMENDED_BY_TYPE[item!.primaryType ?? "general_content"] ?? ["linkedin", "x", "threads"]);
    const ordered = [...recommended, ...SOCIAL_PLATFORMS.filter((p) => !recommended.includes(p))] as SocialPlatform[];
    return ordered.map((platform) => ({ platform, reason: PLATFORM_REASONS[platform], recommended: recommended.includes(platform) }));
  },
});
