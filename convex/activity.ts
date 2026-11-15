import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { LIMITS, type ActivityEventType } from "../src/shared/contracts";
import { getUser, requireOwnedItem } from "./lib/auth";
import { vActivityEventType, vOwnerId } from "./lib/validators";

// OWNER: F. Activity feed. Mutations call logEvent directly; actions call
// internal.activity.log.

export type ActivityEventInput = {
  type: ActivityEventType;
  title: string;
  detail?: string;
  itemId?: Id<"savedItems">;
  executionId?: Id<"actionExecutions">;
  collectionId?: Id<"collections">;
};

export async function logEvent(ctx: MutationCtx, userId: Id<"users">, event: ActivityEventInput): Promise<Id<"activityEvents">> {
  return await ctx.db.insert("activityEvents", {
    userId,
    type: event.type,
    title: event.title.slice(0, 200),
    detail: event.detail?.slice(0, 500),
    itemId: event.itemId,
    executionId: event.executionId,
    collectionId: event.collectionId,
    createdAt: Date.now(),
  });
}

export const log = internalMutation({
  args: {
    userId: v.id("users"),
    type: vActivityEventType,
    title: v.string(),
    detail: v.optional(v.string()),
    itemId: v.optional(v.id("savedItems")),
    executionId: v.optional(v.id("actionExecutions")),
    collectionId: v.optional(v.id("collections")),
  },
  handler: async (ctx, { userId, ...event }) => await logEvent(ctx, userId, event),
});

const vEventView = v.object({
  _id: v.id("activityEvents"),
  type: vActivityEventType,
  title: v.string(),
  detail: v.union(v.string(), v.null()),
  itemId: v.union(v.id("savedItems"), v.null()),
  executionId: v.union(v.id("actionExecutions"), v.null()),
  collectionId: v.union(v.id("collections"), v.null()),
  resultId: v.union(v.id("actionResults"), v.null()),
  createdAt: v.number(),
});

async function toEventView(ctx: QueryCtx, event: Doc<"activityEvents">) {
  const result = event.executionId
    ? await ctx.db
        .query("actionResults")
        .withIndex("by_executionId", (q) => q.eq("executionId", event.executionId!))
        .first()
    : null;
  return {
    _id: event._id,
    type: event.type,
    title: event.title,
    detail: event.detail ?? null,
    itemId: event.itemId ?? null,
    executionId: event.executionId ?? null,
    collectionId: event.collectionId ?? null,
    resultId: result?._id ?? null,
    createdAt: event.createdAt,
  };
}

/** Newest-first activity for the device owner (max 200). Empty for unknown owners. */
export const list = query({
  args: { ownerId: vOwnerId, limit: v.optional(v.number()) },
  returns: v.array(vEventView),
  handler: async (ctx, { ownerId, limit }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return [];
    const take = Math.max(1, Math.min(limit ?? LIMITS.listDefault, LIMITS.listMax));
    const events = await ctx.db
      .query("activityEvents")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(take);
    return await Promise.all(events.map((event) => toEventView(ctx, event)));
  },
});

/** Paginated newest-first activity. Empty (done) page for unknown owners. */
export const listPage = query({
  args: { ownerId: vOwnerId, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { ownerId, paginationOpts }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("activityEvents")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((event) => toEventView(ctx, event))) };
  },
});

/** Newest-first activity for one saved item (max 50). */
export const listForItem = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    await requireOwnedItem(ctx, ownerId, itemId);
    return await ctx.db
      .query("activityEvents")
      .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
      .order("desc")
      .take(LIMITS.listDefault);
  },
});
