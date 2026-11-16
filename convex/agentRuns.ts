import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { AGENT_ACTIONS, ACTION_LABELS } from "../src/shared/contracts";
import { logEvent } from "./activity";
import { getUser, requireOwnedItem, getOwnedItem } from "./lib/auth";
import { parseRepo } from "./lib/runRepo";
import { vOwnerId } from "./lib/validators";

// Agent mode entry points. Kept apart from actions.execute; the E2B work runs
// in convex/agentMode.ts ("use node").

/** Whether "Run it for me" is configured on this deployment. Never returns the key. */
export const runRepoAvailable = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await getUser(ctx, ownerId);
    return !!user && !!process.env.E2B_API_KEY;
  },
});

/** The item's latest run_repo execution, or null. */
export const latestRunRepo = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    if (!(await getOwnedItem(ctx, ownerId, itemId))) return null;
    const recent = await ctx.db
      .query("actionExecutions")
      .withIndex("by_itemId_and_createdAt", (q) => q.eq("itemId", itemId))
      .order("desc")
      .take(50);
    const latest = recent.find((e) => e.actionType === "run_repo");
    if (!latest) return null;
    const result = await ctx.db
      .query("actionResults")
      .withIndex("by_executionId", (q) => q.eq("executionId", latest._id))
      .first();
    return { _id: latest._id, status: latest.status, error: latest.error ?? null, resultId: result?._id ?? null, createdAt: latest.createdAt };
  },
});

/** Starts "Run it for me" on a GitHub save. Returns the executionId; a run in flight is reused. */
export const startRunRepo = mutation({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    const { user, item } = await requireOwnedItem(ctx, ownerId, itemId);
    if (!process.env.E2B_API_KEY) throw new ConvexError("Run it for me isn't configured on this server.");
    if (item.extractionStatus !== "ready") throw new ConvexError("This save is still being understood. Try again in a moment.");
    const allowed = AGENT_ACTIONS.run_repo?.contentTypes ?? [];
    if (!item.primaryType || !allowed.includes(item.primaryType) || !parseRepo(item.sourceUrl)) {
      throw new ConvexError("Run it for me works on GitHub repository saves.");
    }
    const recent = await ctx.db
      .query("actionExecutions")
      .withIndex("by_itemId_and_createdAt", (q) => q.eq("itemId", itemId))
      .order("desc")
      .take(20);
    const inFlight = recent.find((e) => e.actionType === "run_repo" && (e.status === "queued" || e.status === "running"));
    if (inFlight) return inFlight._id;
    const executionId = await ctx.db.insert("actionExecutions", {
      userId: user._id,
      itemId,
      actionType: "run_repo",
      status: "queued",
      inputs: {},
      createdAt: Date.now(),
    });
    await logEvent(ctx, user._id, {
      type: "action_started",
      title: ACTION_LABELS.run_repo.title,
      detail: item.title ?? item.sourceUrl,
      itemId,
      executionId,
    });
    await ctx.scheduler.runAfter(0, internal.agentMode.runRepo, { executionId });
    return executionId;
  },
});
