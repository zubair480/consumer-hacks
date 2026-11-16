import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { requireOwned, requireOwnedItem, requireUser } from "../lib/auth";
import { eventTiming } from "../lib/demo";
import { vOwnerId } from "../lib/validators";
import { vCalendarProposal } from "./schema";
import {
  GCAL_CALLBACK_PATH,
  createCalendarEvent,
  createConnectLink,
  isCalendarConnected,
  safeReturnUrl,
} from "./composio";

// Flow: prepare -> needs_approval -> approve (only path to Composio) -> execute -> completed.

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const jobView = (j: Doc<"agentJobs">) => ({
  _id: j._id,
  status: j.status,
  proposal: j.proposal,
  resultUrl: j.resultUrl,
  error: j.error,
});

/** Drafts a proposal from the item's saved facts only. A missing date stays empty for the user to fill. */
export const prepare = mutation({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems"), timezone: v.optional(v.string()) },
  handler: async (ctx, { ownerId, itemId, timezone }) => {
    const { user, item } = await requireOwnedItem(ctx, ownerId, itemId);
    const analysis = await ctx.db
      .query("contentAnalysis")
      .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
      .order("desc")
      .first();
    const facts = analysis?.facts ?? [];
    const timeFirst = [...facts].sort((a, b) => Number(/time|date|when|start/i.test(b.key)) - Number(/time|date|when|start/i.test(a.key)));
    const now = Date.now();
    const timing = eventTiming([item.rawText ?? "", ...timeFirst.map((f) => `${f.value} ${f.evidence.quote}`), item.summary ?? "", item.title ?? ""], item.deadline, now);
    return await ctx.db.insert("agentJobs", {
      userId: user._id,
      itemId,
      kind: "calendar",
      status: "needs_approval",
      proposal: {
        summary: item.title ?? "Saved item",
        description: [item.summary, item.location ? `Location: ${item.location}` : "", item.sourceUrl].filter(Boolean).join("\n\n"),
        location: item.location ?? "",
        startDateTime: timing.startDateTime,
        timezone: timezone || "America/Los_Angeles",
        durationMinutes: timing.durationMinutes,
      },
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Boolean only: whether Composio is configured on the deployment. Never returns the key. */
export const configured = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    await requireUser(ctx, ownerId);
    return !!process.env.COMPOSIO_API_KEY;
  },
});

export const latestForItem = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    const { user } = await requireOwnedItem(ctx, ownerId, itemId);
    const jobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_userId_and_itemId", (q) => q.eq("userId", user._id).eq("itemId", itemId))
      .order("desc")
      .take(1);
    return jobs[0] ? jobView(jobs[0]) : null;
  },
});

export const updateProposal = mutation({
  args: { ownerId: vOwnerId, jobId: v.id("agentJobs"), proposal: vCalendarProposal },
  handler: async (ctx, { ownerId, jobId, proposal }) => {
    const user = await requireUser(ctx, ownerId);
    const job = await requireOwned(ctx, user, jobId);
    if (job.status !== "needs_approval") throw new ConvexError("This proposal can no longer be edited");
    await ctx.db.patch(jobId, { proposal, updatedAt: Date.now() });
    return null;
  },
});

export const approve = mutation({
  args: { ownerId: vOwnerId, jobId: v.id("agentJobs") },
  handler: async (ctx, { ownerId, jobId }) => {
    const user = await requireUser(ctx, ownerId);
    const job = await requireOwned(ctx, user, jobId);
    if (job.status !== "needs_approval") throw new ConvexError("Nothing to approve");
    if (!DATE_TIME.test(job.proposal.startDateTime)) throw new ConvexError("Add a start date and time first (YYYY-MM-DDTHH:MM:SS)");
    await ctx.db.patch(jobId, { status: "running", error: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.agents.calendar.execute, { jobId });
    return null;
  },
});

export const cancel = mutation({
  args: { ownerId: vOwnerId, jobId: v.id("agentJobs") },
  handler: async (ctx, { ownerId, jobId }) => {
    const user = await requireUser(ctx, ownerId);
    const job = await requireOwned(ctx, user, jobId);
    if (job.status === "completed" || job.status === "cancelled") return null;
    await ctx.db.patch(jobId, { status: "cancelled", updatedAt: Date.now() });
    return null;
  },
});

/** Back to the approval step after a failure or cancel. Still needs a fresh approve. */
export const retry = mutation({
  args: { ownerId: vOwnerId, jobId: v.id("agentJobs") },
  handler: async (ctx, { ownerId, jobId }) => {
    const user = await requireUser(ctx, ownerId);
    const job = await requireOwned(ctx, user, jobId);
    if (job.status !== "failed" && job.status !== "cancelled") throw new ConvexError("Nothing to retry");
    await ctx.db.patch(jobId, { status: "needs_approval", error: undefined, updatedAt: Date.now() });
    return null;
  },
});

export const loadForExecute = internalQuery({
  args: { jobId: v.id("agentJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    return job && job.status === "running" ? { userId: job.userId, proposal: job.proposal } : null;
  },
});

export const finish = internalMutation({
  args: { jobId: v.id("agentJobs"), resultUrl: v.optional(v.string()), error: v.optional(v.string()) },
  handler: async (ctx, { jobId, resultUrl, error }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "running") return null;
    await ctx.db.patch(jobId, error ? { status: "failed", error, updatedAt: Date.now() } : { status: "completed", resultUrl, updatedAt: Date.now() });
    return null;
  },
});

export const execute = internalAction({
  args: { jobId: v.id("agentJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.runQuery(internal.agents.calendar.loadForExecute, { jobId });
    if (!job) return null;
    try {
      const url = await createCalendarEvent(String(job.userId), job.proposal);
      await ctx.runMutation(internal.agents.calendar.finish, { jobId, resultUrl: url ?? "https://calendar.google.com/calendar" });
    } catch (e) {
      await ctx.runMutation(internal.agents.calendar.finish, { jobId, error: (e instanceof Error ? e.message : "Calendar failed").slice(0, 300) });
    }
    return null;
  },
});

export const userIdFor = internalQuery({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => String((await requireUser(ctx, ownerId))._id),
});

/** Starts Google Calendar OAuth through Composio. Open the result in an auth session returning to returnUrl. */
export const startConnect = action({
  args: { ownerId: vOwnerId, returnUrl: v.string() },
  handler: async (ctx, { ownerId, returnUrl }): Promise<{ redirectUrl: string }> => {
    const back = safeReturnUrl(returnUrl);
    if (!back) throw new ConvexError("Invalid return URL");
    const userId: string = await ctx.runQuery(internal.agents.calendar.userIdFor, { ownerId });
    const site = process.env.CONVEX_SITE_URL;
    if (!site) throw new ConvexError("Server has no site URL");
    const callback = `${site}${GCAL_CALLBACK_PATH}?return=${encodeURIComponent(back)}`;
    return { redirectUrl: await createConnectLink(userId, callback) };
  },
});

export const connectionStatus = action({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }): Promise<{ connected: boolean }> => {
    const userId: string = await ctx.runQuery(internal.agents.calendar.userIdFor, { ownerId });
    return { connected: await isCalendarConnected(userId).catch(() => false) };
  },
});
