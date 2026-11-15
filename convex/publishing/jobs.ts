import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { getUser, requireOwned, requireUser } from "../lib/auth";
import { vOwnerId } from "../lib/validators";
import type { SocialDraftStatus } from "../../src/shared/socialContracts";
import { ACCOUNT_PLATFORMS, ADAPTERS } from "./index";
import type { PublishResult } from "./types";

// OWNER: Thread J (CONS-11). Per-platform publishing jobs.
// "published" is set only by finishPublish with a post id an adapter got back
// from the provider. Share-sheet flows end at awaiting_user_action, and a user
// saying "I posted it" is a user_reported_shared result, never published.

export type PublishStatusView = {
  draftId: Id<"socialDrafts">;
  platform: Doc<"socialDrafts">["platform"];
  status: SocialDraftStatus;
  url: string | null;
  userReportedPostedAt: number | null;
  error: string | null;
  updatedAt: number;
};

const IN_FLIGHT_MS = 2 * 60 * 1000;

async function latestJob(ctx: QueryCtx, draftId: Id<"socialDrafts">) {
  return await ctx.db
    .query("publishingJobs")
    .withIndex("by_draftId", (q) => q.eq("draftId", draftId))
    .order("desc")
    .first();
}

async function userReport(ctx: QueryCtx, draftId: Id<"socialDrafts">) {
  const results = await ctx.db
    .query("publishingResults")
    .withIndex("by_draftId", (q) => q.eq("draftId", draftId))
    .take(100);
  return results.find((r) => r.outcome === "user_reported_shared") ?? null;
}

async function statusView(ctx: QueryCtx, draft: Doc<"socialDrafts">): Promise<PublishStatusView> {
  const job = await latestJob(ctx, draft._id);
  const report = await userReport(ctx, draft._id);
  return {
    draftId: draft._id,
    platform: draft.platform,
    status: job?.status ?? draft.status,
    url: job?.status === "published" ? (job.url ?? null) : null,
    userReportedPostedAt: report?.createdAt ?? null,
    error: job?.error ?? null,
    updatedAt: job?.updatedAt ?? draft.updatedAt,
  };
}

async function loadReadyDraft(ctx: QueryCtx, ownerId: string, draftId: Id<"socialDrafts">) {
  const user = await requireUser(ctx, ownerId);
  const draft = await requireOwned(ctx, user, draftId);
  if (draft.generationStatus !== "ready") throw new ConvexError("This draft is still generating");
  return { user, draft };
}

/** Share-sheet transitions. Re-applying the current status is a no-op. A published revision is never moved back. */
async function transition(
  ctx: MutationCtx,
  ownerId: string,
  draftId: Id<"socialDrafts">,
  status: "ready_to_share" | "awaiting_user_action" | "failed",
  error?: string,
): Promise<PublishStatusView> {
  const { user, draft } = await loadReadyDraft(ctx, ownerId, draftId);
  const job = await latestJob(ctx, draftId);
  if (job?.status === "published" && job.draftRevision === draft.revision) {
    throw new ConvexError("This draft is already published");
  }
  if (job?.status === "publishing") throw new ConvexError("This draft is publishing right now");
  if (job?.status === status && job.error === error) return await statusView(ctx, draft);

  const now = Date.now();
  let jobId = job && job.status !== "published" ? job._id : undefined;
  if (jobId) {
    await ctx.db.patch("publishingJobs", jobId, { status, error, draftRevision: draft.revision, updatedAt: now });
  } else {
    jobId = await ctx.db.insert("publishingJobs", {
      userId: user._id,
      draftId,
      platform: draft.platform,
      status,
      error,
      draftRevision: draft.revision,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  await ctx.db.patch("socialDrafts", draftId, { status });
  if (status === "failed") {
    await ctx.db.insert("publishingResults", {
      userId: user._id,
      jobId,
      draftId,
      platform: draft.platform,
      outcome: "failed",
      error,
      createdAt: now,
    });
  }
  return await statusView(ctx, (await ctx.db.get("socialDrafts", draftId))!);
}

export const markReadyToShare = mutation({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts") },
  handler: (ctx, { ownerId, draftId }) => transition(ctx, ownerId, draftId, "ready_to_share"),
});

/** Called right before the share sheet or an "Open in …" link. Never means the post went live. */
export const startShare = mutation({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts") },
  handler: (ctx, { ownerId, draftId }) => transition(ctx, ownerId, draftId, "awaiting_user_action"),
});

/** The user says they posted it. Recorded once as user_reported_shared; the status is not set to published. */
export const confirmUserPosted = mutation({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts") },
  handler: async (ctx, { ownerId, draftId }) => {
    const user = await requireUser(ctx, ownerId);
    const draft = await requireOwned(ctx, user, draftId);
    const job = await latestJob(ctx, draftId);
    if (!job || job.status !== "awaiting_user_action") {
      throw new ConvexError("Open the share sheet for this draft before confirming you posted it");
    }
    if (!(await userReport(ctx, draftId))) {
      await ctx.db.insert("publishingResults", {
        userId: user._id,
        jobId: job._id,
        draftId,
        platform: draft.platform,
        outcome: "user_reported_shared",
        createdAt: Date.now(),
      });
    }
    return await statusView(ctx, draft);
  },
});

export const markFailed = mutation({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts"), error: v.string() },
  handler: (ctx, { ownerId, draftId, error }) => transition(ctx, ownerId, draftId, "failed", error.slice(0, 500)),
});

type BeginResult =
  | {
      kind: "go";
      jobId: Id<"publishingJobs">;
      platform: Doc<"socialDrafts">["platform"];
      text: string;
      sourceUrl?: string;
      imageUrl?: string;
    }
  | { kind: "done" };

const publishArgs = {
  ownerId: vOwnerId,
  draftId: v.id("socialDrafts"),
  revision: v.number(),
  imageStorageId: v.optional(v.id("_storage")),
};

/** The image only if this user owns it: the draft's source media, or one of the user's mediaAssets. */
async function ownedImageUrl(
  ctx: MutationCtx,
  user: Doc<"users">,
  draft: Doc<"socialDrafts">,
  storageId: Id<"_storage">,
) {
  const source = draft.sourceMediaId ? await ctx.db.get("mediaAssets", draft.sourceMediaId) : null;
  const owned =
    source?.storageId === storageId ||
    (
      await ctx.db
        .query("mediaAssets")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(200)
    ).some((m) => m.storageId === storageId);
  if (!owned) throw new ConvexError("Not found");
  const url = await ctx.storage.getUrl(storageId);
  if (!url) throw new ConvexError("The image is no longer available");
  return url;
}

export const beginPublish = internalMutation({
  args: publishArgs,
  handler: async (ctx, { ownerId, draftId, revision, imageStorageId }): Promise<BeginResult> => {
    const { user, draft } = await loadReadyDraft(ctx, ownerId, draftId);
    if (draft.revision !== revision)
      throw new ConvexError("This draft changed since you reviewed it. Check the text and confirm again.");
    const adapter = ADAPTERS[draft.platform];
    if (!adapter) throw new ConvexError("This platform uses copy and the share sheet for now");
    const item = draft.sourceSavedItemId ? await ctx.db.get("savedItems", draft.sourceSavedItemId) : null;
    const sourceUrl = item?.sourceUrl ?? undefined;
    if (!adapter.isConfigured()) throw new ConvexError("This account is not connected. Use Open in or Copy instead.");
    const imageUrl = imageStorageId ? await ownedImageUrl(ctx, user, draft, imageStorageId) : undefined;

    const jobs = await ctx.db
      .query("publishingJobs")
      .withIndex("by_draftId", (q) => q.eq("draftId", draftId))
      .take(100);
    const same = jobs.filter((j) => j.platform === draft.platform && j.draftRevision === revision);
    if (same.some((j) => j.status === "published")) return { kind: "done" };
    const now = Date.now();
    if (same.some((j) => j.status === "publishing" && now - j.updatedAt < IN_FLIGHT_MS)) {
      return { kind: "done" };
    }
    const job = await latestJob(ctx, draftId);
    let jobId = job && job.status !== "published" ? job._id : undefined;
    if (jobId && job) {
      await ctx.db.patch("publishingJobs", jobId, {
        status: "publishing",
        error: undefined,
        draftRevision: revision,
        attempts: (job.attempts ?? 0) + 1,
        updatedAt: now,
      });
    } else {
      jobId = await ctx.db.insert("publishingJobs", {
        userId: user._id,
        draftId,
        platform: draft.platform,
        status: "publishing",
        draftRevision: revision,
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch("socialDrafts", draftId, { status: "publishing" });
    return { kind: "go", jobId, platform: draft.platform, text: draft.draftText, sourceUrl, imageUrl };
  },
});

export const finishPublish = internalMutation({
  args: {
    jobId: v.id("publishingJobs"),
    status: v.union(v.literal("published"), v.literal("failed")),
    externalPostIds: v.optional(v.array(v.string())),
    url: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, status, externalPostIds, url, error }) => {
    const job = await ctx.db.get("publishingJobs", jobId);
    if (!job) throw new ConvexError("Not found");
    const now = Date.now();
    const ids = externalPostIds ?? [];
    if (status === "published" && !ids.length) throw new ConvexError("Published requires a provider post id");
    await ctx.db.patch("publishingJobs", jobId, {
      status,
      error,
      url: status === "published" ? url : undefined,
      externalPostId: ids[0],
      publishedAt: status === "published" ? now : undefined,
      updatedAt: now,
    });
    await ctx.db.patch("socialDrafts", job.draftId, { status });
    const base = { userId: job.userId, jobId, draftId: job.draftId, platform: job.platform, createdAt: now };
    if (status === "failed") await ctx.db.insert("publishingResults", { ...base, outcome: "failed", error });
    for (const [i, id] of ids.entries()) {
      await ctx.db.insert("publishingResults", {
        ...base,
        outcome: "published",
        externalPostId: id,
        externalUrl: i === 0 ? url : undefined,
        error: i === 0 ? error : undefined,
      });
    }
  },
});

export const loadStatus = internalQuery({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts") },
  handler: async (ctx, { ownerId, draftId }) => {
    const user = await requireUser(ctx, ownerId);
    return await statusView(ctx, await requireOwned(ctx, user, draftId));
  },
});

/**
 * Publishes a draft through its platform adapter after the user confirmed the exact text.
 * Idempotent per draft revision: an already published revision returns its post without posting again.
 * Throws when the platform has no adapter or is not configured; the client uses its fallback (Open in / share sheet).
 */
export const publish = action({
  args: publishArgs,
  handler: async (ctx, args): Promise<PublishStatusView> => {
    const begin: BeginResult = await ctx.runMutation(internal.publishing.jobs.beginPublish, args);
    if (begin.kind === "go") {
      let result: PublishResult;
      try {
        result = await ADAPTERS[begin.platform]!.publish(begin.text, {
          sourceUrl: begin.sourceUrl,
          imageUrl: begin.imageUrl,
        });
      } catch (e) {
        console.error("publish adapter threw", e);
        result = { status: "failed", error: "Could not reach the platform. Try again." };
      }
      await ctx.runMutation(
        internal.publishing.jobs.finishPublish,
        result.status === "published"
          ? {
              jobId: begin.jobId,
              status: "published",
              externalPostIds: result.externalPostIds.length ? result.externalPostIds : [result.externalPostId],
              url: result.url,
              error: result.partialError,
            }
          : {
              jobId: begin.jobId,
              status: "failed",
              error:
                result.status === "failed"
                  ? result.error
                  : "The platform is not connected. Use Open in or Copy instead.",
            },
      );
    }
    return await ctx.runQuery(internal.publishing.jobs.loadStatus, { ownerId: args.ownerId, draftId: args.draftId });
  },
});

export const statusForDraft = query({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts") },
  handler: async (ctx, { ownerId, draftId }) => {
    const user = await requireUser(ctx, ownerId);
    return await statusView(ctx, await requireOwned(ctx, user, draftId));
  },
});

/** Publishing status of every draft for one source (exactly one of itemId/mediaId). */
export const listForSource = query({
  args: { ownerId: vOwnerId, itemId: v.optional(v.id("savedItems")), mediaId: v.optional(v.id("mediaAssets")) },
  handler: async (ctx, { ownerId, itemId, mediaId }) => {
    if (!itemId === !mediaId) throw new ConvexError("Pass exactly one of itemId or mediaId");
    const user = await getUser(ctx, ownerId);
    if (!user) return [];
    const drafts = itemId
      ? await ctx.db
          .query("socialDrafts")
          .withIndex("by_userId_and_sourceSavedItemId", (q) => q.eq("userId", user._id).eq("sourceSavedItemId", itemId))
          .take(50)
      : await ctx.db
          .query("socialDrafts")
          .withIndex("by_userId_and_sourceMediaId", (q) => q.eq("userId", user._id).eq("sourceMediaId", mediaId))
          .take(50);
    return await Promise.all(drafts.map((d) => statusView(ctx, d)));
  },
});

/** Which platforms can post directly (credentials configured) vs share-sheet mode. Booleans only, never secrets. */
export const connectedAccounts = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    await getUser(ctx, ownerId);
    return ACCOUNT_PLATFORMS.map((platform) => ({
      platform,
      hasAdapter: ADAPTERS[platform] !== undefined,
      connected: ADAPTERS[platform]?.isConfigured() ?? false,
    }));
  },
});
