import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { detectSourcePlatform, LIMITS } from "../src/shared/contracts";
import { ensureUser, getUser, requireOwnedItem } from "./lib/auth";
import { boxFor, demoSaves, emptyBoxes, isV1DemoSave, primaryAgentAction } from "./lib/demo";
import { vOwnerId } from "./lib/validators";

export { DEMO_EVENT_TEXT } from "./lib/demo";

const ANALYZED = ["ready", "needs_input", "failed"];

async function deleteSave(ctx: MutationCtx, item: Doc<"savedItems">) {
  const itemId = item._id;
  const derived = await Promise.all([
    ctx.db.query("contentAnalysis").withIndex("by_itemId", (q) => q.eq("itemId", itemId)).take(100),
    ctx.db.query("actionSuggestions").withIndex("by_itemId_and_rank", (q) => q.eq("itemId", itemId)).take(100),
    ctx.db.query("actionExecutions").withIndex("by_itemId_and_createdAt", (q) => q.eq("itemId", itemId)).take(100),
    ctx.db.query("actionResults").withIndex("by_itemId", (q) => q.eq("itemId", itemId)).take(100),
    ctx.db.query("formFillRuns").withIndex("by_userId_and_itemId", (q) => q.eq("userId", item.userId).eq("itemId", itemId)).take(100),
    ctx.db.query("agentJobs").withIndex("by_userId_and_itemId", (q) => q.eq("userId", item.userId).eq("itemId", itemId)).take(100),
  ]);
  for (const doc of derived.flat()) await ctx.db.delete(doc._id);
  await ctx.db.delete("savedItems", itemId);
}

/**
 * Seeds the 4 v2 demo saves (repo, camp, scholarship, summit; oldest first) the owner is missing, removes v1 demo saves,
 * and schedules normal ingestion. Idempotent per owner (demoKey). Also syncs X bookmarks when X is connected.
 */
export const pullEverything = mutation({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await ensureUser(ctx, ownerId);
    const existing = await ctx.db
      .query("savedItems")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(LIMITS.listMax);
    for (const old of existing.filter((i) => isV1DemoSave(i))) await deleteSave(ctx, old);
    let created = 0;
    const base = Date.now();
    for (const [index, save] of demoSaves().entries()) {
      const has = existing.find((i) => i.demoKey === save.key);
      if (has) {
        if (has.extractionStatus === "needs_input" || has.extractionStatus === "failed") {
          await ctx.db.patch(has._id, { rawText: save.rawText, extractionStatus: "pending", extractionError: undefined, updatedAt: Date.now() });
          await ctx.scheduler.runAfter(0, internal.ingest.run, { itemId: has._id });
        }
        continue;
      }
      const now = base + index;
      const itemId = await ctx.db.insert("savedItems", {
        userId: user._id,
        demoKey: save.key,
        sourceKind: "url",
        sourceUrl: save.sourceUrl,
        sourcePlatform: detectSourcePlatform(save.sourceUrl),
        rawText: save.rawText,
        contentTypes: [],
        extractionStatus: "pending",
        searchText: `${save.sourceUrl} ${save.rawText}`.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("activityEvents", { userId: user._id, createdAt: now, type: "item_saved", title: "Saved", detail: save.sourceUrl, itemId });
      await ctx.scheduler.runAfter(0, internal.ingest.run, { itemId });
      created++;
    }
    const x = await ctx.db
      .query("importConnections")
      .withIndex("by_userId_and_platform", (q) => q.eq("userId", user._id).eq("platform", "x"))
      .unique();
    if (x) await ctx.scheduler.runAfter(0, api.imports.connections.syncX, { ownerId });
    return { created, xSync: !!x };
  },
});

/** Pull progress over the owner's saves: how many are analyzed, and the analyzed ones per box. */
export const pullStatus = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const byBox = emptyBoxes();
    const user = await getUser(ctx, ownerId);
    if (!user) return { total: 0, analyzed: 0, done: false, byBox };
    const items = await ctx.db
      .query("savedItems")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(LIMITS.listMax);
    const analyzed = items.filter((i) => ANALYZED.includes(i.extractionStatus));
    for (const i of analyzed) byBox[boxFor(i.primaryType)]++;
    return { total: items.length, analyzed: analyzed.length, done: items.length > 0 && analyzed.length === items.length, byBox };
  },
});

/** The item's box and its one big action: Run it for me (Code), Fill it for me (Forms), Add to my calendar (Events), else null. */
export const primaryAction = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    const { item } = await requireOwnedItem(ctx, ownerId, itemId);
    return { box: boxFor(item.primaryType), action: primaryAgentAction(item.primaryType) };
  },
});

export const recordSubmission = internalMutation({
  args: { name: v.string(), email: v.string(), phone: v.string(), studying: v.string(), program: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const createdAt = Date.now();
    await ctx.db.insert("demoFormSubmissions", { ...args, createdAt });
    return createdAt;
  },
});

export const recentSubmissions = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"demoFormSubmissions">[]> => {
    return await ctx.db.query("demoFormSubmissions").withIndex("by_createdAt").order("desc").take(10);
  },
});
