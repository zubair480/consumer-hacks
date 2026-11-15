import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { getUser, requireOwned, requireUser } from "./lib/auth";
import { vOwnerId } from "./lib/validators";
import { SOCIAL_PLATFORMS, type SocialDraftStatus } from "../src/shared/socialContracts";

// OWNER: Thread J (CONS-11). Per-platform publishing records.
// There are no platform publishing APIs: sharing goes through copy + the native
// share sheet. "published" is reserved for a confirmed provider success, and no
// provider path exists, so no function here can reach it. A user saying
// "I posted it" is recorded as a user_reported_shared result, never as published.

type StatusView = {
  draftId: Id<"socialDrafts">;
  platform: Doc<"socialDrafts">["platform"];
  status: SocialDraftStatus;
  userReportedPostedAt: number | null;
  error: string | null;
  updatedAt: number;
};

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
    .collect();
  return results.find((r) => r.outcome === "user_reported_shared") ?? null;
}

async function statusView(ctx: QueryCtx, draft: Doc<"socialDrafts">): Promise<StatusView> {
  const job = await latestJob(ctx, draft._id);
  const report = await userReport(ctx, draft._id);
  return {
    draftId: draft._id,
    platform: draft.platform,
    status: job?.status ?? draft.status,
    userReportedPostedAt: report?.createdAt ?? null,
    error: job?.status === "failed" ? (job.error ?? null) : null,
    updatedAt: job?.updatedAt ?? draft.updatedAt,
  };
}

/** Moves the draft and its job to status. Re-applying the current status is a no-op. */
async function transition(
  ctx: MutationCtx,
  ownerId: string,
  draftId: Id<"socialDrafts">,
  status: Exclude<SocialDraftStatus, "published" | "publishing">,
  error?: string,
): Promise<StatusView> {
  const user = await requireUser(ctx, ownerId);
  const draft = await requireOwned(ctx, user, draftId);
  if (draft.generationStatus !== "ready") throw new ConvexError("This draft is still generating");
  const job = await latestJob(ctx, draftId);
  if (job?.status === "published") throw new ConvexError("This draft is already published");
  const now = Date.now();
  if (job?.status === status && job.error === error) return await statusView(ctx, draft);

  let jobId = job?._id;
  if (jobId)
    await ctx.db.patch("publishingJobs", jobId, {
      status,
      error,
      updatedAt: now,
    });
  else
    jobId = await ctx.db.insert("publishingJobs", {
      userId: user._id,
      draftId,
      platform: draft.platform,
      status,
      error,
      createdAt: now,
      updatedAt: now,
    });
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

/** Called right before the native share sheet opens. Never means the post went live. */
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

export const statusForDraft = query({
  args: { ownerId: vOwnerId, draftId: v.id("socialDrafts") },
  handler: async (ctx, { ownerId, draftId }) => {
    const user = await requireUser(ctx, ownerId);
    return await statusView(ctx, await requireOwned(ctx, user, draftId));
  },
});

/** Publishing status of every draft for one source (exactly one of itemId/mediaId). */
export const listForSource = query({
  args: {
    ownerId: vOwnerId,
    itemId: v.optional(v.id("savedItems")),
    mediaId: v.optional(v.id("mediaAssets")),
  },
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

/** Connection state per platform. No OAuth is implemented, so every platform is not_connected. */
export const platformConnections = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await getUser(ctx, ownerId);
    return await Promise.all(
      SOCIAL_PLATFORMS.map(async (platform) => {
        const row = user
          ? await ctx.db
              .query("platformConnections")
              .withIndex("by_userId_and_platform", (q) => q.eq("userId", user._id).eq("platform", platform))
              .unique()
          : null;
        return {
          platform,
          connectionStatus: row?.connectionStatus ?? ("not_connected" as const),
        };
      }),
    );
  },
});
