import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireOwned, requireOwnedItem, requireUser } from "./lib/auth";
import { vFormFillField, vFormFillStatus } from "./formFillSchema";
import { vOwnerId } from "./lib/validators";

const ACTIVE = ["queued", "filling", "needs_approval", "approved"];

/** True only when the server holds the keys the agent needs. Never returns a key. */
export const available = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    await requireUser(ctx, ownerId);
    return Boolean(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID && process.env.OPENAI_API_KEY);
  },
});

export const start = mutation({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    const { user, item } = await requireOwnedItem(ctx, ownerId, itemId);
    if (!item.contentTypes.includes("scholarship")) throw new ConvexError("Fill it for me is for scholarships");
    if (!item.sourceUrl || !/^https?:\/\//i.test(item.sourceUrl)) throw new ConvexError("This save has no link to open");
    const existing = await ctx.db
      .query("formFillRuns")
      .withIndex("by_userId_and_itemId", (q) => q.eq("userId", user._id).eq("itemId", itemId))
      .order("desc")
      .first();
    if (existing && ACTIVE.includes(existing.status)) return existing._id;
    const now = Date.now();
    const runId = await ctx.db.insert("formFillRuns", {
      userId: user._id,
      itemId,
      url: item.sourceUrl,
      status: "queued",
      fields: [],
      screenshotIds: [],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.formFillAgent.run, { runId });
    return runId;
  },
});

async function view(ctx: Parameters<typeof requireOwned>[0], run: NonNullable<Awaited<ReturnType<typeof requireOwned<"formFillRuns">>>>) {
  const screenshots: string[] = [];
  for (const id of run.screenshotIds) {
    const url = await ctx.storage.getUrl(id);
    if (url) screenshots.push(url);
  }
  const { screenshotIds: _ids, userId: _u, ...rest } = run;
  return { ...rest, screenshots };
}

export const get = query({
  args: { ownerId: vOwnerId, runId: v.id("formFillRuns") },
  handler: async (ctx, { ownerId, runId }) => {
    const user = await requireUser(ctx, ownerId);
    return await view(ctx, await requireOwned(ctx, user, runId));
  },
});

export const latestForItem = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    const { user } = await requireOwnedItem(ctx, ownerId, itemId);
    const run = await ctx.db
      .query("formFillRuns")
      .withIndex("by_userId_and_itemId", (q) => q.eq("userId", user._id).eq("itemId", itemId))
      .order("desc")
      .first();
    return run ? { _id: run._id, status: run.status } : null;
  },
});

export const approve = mutation({
  args: { ownerId: vOwnerId, runId: v.id("formFillRuns") },
  handler: async (ctx, { ownerId, runId }) => {
    const user = await requireUser(ctx, ownerId);
    const run = await requireOwned(ctx, user, runId);
    if (run.status !== "needs_approval") throw new ConvexError("Nothing to approve");
    if (run.expiresAt !== undefined && Date.now() > run.expiresAt) throw new ConvexError("This session expired");
    await ctx.db.patch("formFillRuns", runId, { status: "approved", updatedAt: Date.now() });
    return null;
  },
});

/** Cancel, or "I'm done" after approval: either way the agent closes the browser session. */
export const cancel = mutation({
  args: { ownerId: vOwnerId, runId: v.id("formFillRuns") },
  handler: async (ctx, { ownerId, runId }) => {
    const user = await requireUser(ctx, ownerId);
    const run = await requireOwned(ctx, user, runId);
    if (!ACTIVE.includes(run.status)) return null;
    await ctx.db.patch("formFillRuns", runId, { status: "cancelled", updatedAt: Date.now() });
    return null;
  },
});

export const loadContext = internalQuery({
  args: { runId: v.id("formFillRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run) return null;
    const item = await ctx.db.get(run.itemId);
    const prefs = await ctx.db.query("userPreferences").withIndex("by_userId", (q) => q.eq("userId", run.userId)).unique();
    return {
      status: run.status,
      url: run.url,
      title: item?.title ?? "",
      summary: item?.summary ?? "",
      profile: prefs
        ? {
            name: prefs.name,
            educationLevel: prefs.educationLevel,
            fieldOfStudy: prefs.fieldOfStudy,
            country: prefs.country,
            citizenship: prefs.citizenship,
            gpa: prefs.gpa,
            city: prefs.city,
            interests: prefs.interests,
            ...(prefs.profileFacts ?? {}),
          }
        : {},
    };
  },
});

export const getStatus = internalQuery({
  args: { runId: v.id("formFillRuns") },
  handler: async (ctx, { runId }) => (await ctx.db.get(runId))?.status ?? null,
});

/** Moves a run to a new status. Terminal states are never overwritten. */
export const setState = internalMutation({
  args: {
    runId: v.id("formFillRuns"),
    status: vFormFillStatus,
    fields: v.optional(v.array(vFormFillField)),
    screenshotIds: v.optional(v.array(v.id("_storage"))),
    liveViewUrl: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    onlyFrom: v.optional(v.array(vFormFillStatus)),
  },
  handler: async (ctx, { runId, onlyFrom, ...patch }) => {
    const run = await ctx.db.get(runId);
    if (!run) return false;
    if (onlyFrom ? !onlyFrom.includes(run.status) : ["cancelled", "failed", "blocked", "expired"].includes(run.status)) return false;
    await ctx.db.patch("formFillRuns", runId, { ...patch, updatedAt: Date.now() });
    return true;
  },
});
