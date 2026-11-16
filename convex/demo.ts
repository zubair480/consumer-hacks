import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { detectSourcePlatform, LIMITS } from "../src/shared/contracts";
import { ensureUser, getUser, requireOwnedItem } from "./lib/auth";
import { boxFor, demoSaves, emptyBoxes, primaryAgentAction } from "./lib/demo";
import { vOwnerId } from "./lib/validators";

export { DEMO_EVENT_TEXT } from "./lib/demo";

const ANALYZED = ["ready", "needs_input", "failed"];

/** Inserts the 3 demo saves the owner is missing, schedules their normal ingestion, and syncs X bookmarks when X is connected. Idempotent. */
export const pullEverything = mutation({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await ensureUser(ctx, ownerId);
    const existing = await ctx.db
      .query("savedItems")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(LIMITS.listMax);
    let created = 0;
    for (const save of demoSaves()) {
      const has = existing.some((i) => (save.sourceUrl ? i.sourceUrl === save.sourceUrl : i.rawText === save.rawText));
      if (has) continue;
      const now = Date.now();
      const itemId = await ctx.db.insert("savedItems", {
        userId: user._id,
        sourceKind: save.sourceUrl ? "url" : "text",
        sourceUrl: save.sourceUrl,
        sourcePlatform: save.sourceUrl ? detectSourcePlatform(save.sourceUrl) : "manual",
        rawText: save.rawText,
        contentTypes: [],
        extractionStatus: "pending",
        searchText: [save.sourceUrl, save.rawText].filter(Boolean).join(" ").toLowerCase(),
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("activityEvents", { userId: user._id, createdAt: now, type: "item_saved", title: "Saved", detail: save.sourceUrl ?? save.rawText?.slice(0, 80) ?? "Saved", itemId });
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
  args: { name: v.string(), email: v.string(), phone: v.string(), studying: v.string() },
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
