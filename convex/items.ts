import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { detectSourcePlatform, LIMITS, type SavedItemView } from "../src/shared/contracts";
import { ensureUser, getUser, requireOwned, requireOwnedItem, requireUser, getOwnedItem } from "./lib/auth";
import { keyFactFields, vContentType, vExtractionStatus, vOwnerId } from "./lib/validators";

// OWNER: Lead. Saved item CRUD. Ingestion/analysis (B+C) writes back through
// internal.items.setExtraction; activity logging (F) may hook logActivity.

function buildSearchText(item: Pick<Doc<"savedItems">, "title" | "summary" | "rawText" | "sourceUrl">): string {
  return [item.title, item.summary, item.sourceUrl, item.rawText?.slice(0, 4000)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length > LIMITS.urlMaxChars) throw new ConvexError("URL is too long");
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!/^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(withScheme)) throw new ConvexError("That doesn't look like a valid link");
  return withScheme;
}

async function toView(ctx: QueryCtx, item: Doc<"savedItems">): Promise<SavedItemView> {
  const { userId: _userId, searchText: _searchText, collectionIds: _collectionIds, ...rest } = item;
  return { ...rest, imageUrl: item.imageStorageId ? await ctx.storage.getUrl(item.imageStorageId) : null };
}

async function logActivity(
  ctx: MutationCtx,
  userId: Id<"users">,
  event: Omit<Doc<"activityEvents">, "_id" | "_creationTime" | "userId" | "createdAt">,
) {
  await ctx.db.insert("activityEvents", { userId, createdAt: Date.now(), ...event });
}

/** Signed upload URL for a screenshot/photo. POST the file, then pass storageId to create. */
export const generateUploadUrl = mutation({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    await ensureUser(ctx, ownerId);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Saves a URL, pasted text, or uploaded image (any combination; at least one).
 * Starts as extractionStatus "pending" and schedules internal.ingest.run.
 */
export const create = mutation({
  args: {
    ownerId: vOwnerId,
    sourceUrl: v.optional(v.string()),
    rawText: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.ownerId);
    const sourceUrl = args.sourceUrl?.trim() ? normalizeUrl(args.sourceUrl) : undefined;
    const rawText = args.rawText?.trim() || undefined;
    if (rawText && rawText.length > LIMITS.rawTextMaxChars) throw new ConvexError("Text is too long");
    if (!sourceUrl && !rawText && !args.imageStorageId) throw new ConvexError("Add a link, some text, or an image");
    if (args.imageStorageId && !(await ctx.db.system.get("_storage", args.imageStorageId))) {
      throw new ConvexError("Upload not found");
    }
    const now = Date.now();
    const fields = { sourceUrl, rawText, title: undefined, summary: undefined };
    const itemId = await ctx.db.insert("savedItems", {
      userId: user._id,
      sourceKind: args.imageStorageId ? "image" : sourceUrl ? "url" : "text",
      sourceUrl,
      sourcePlatform: sourceUrl ? detectSourcePlatform(sourceUrl) : "manual",
      rawText,
      imageStorageId: args.imageStorageId,
      contentTypes: [],
      extractionStatus: "pending",
      searchText: buildSearchText(fields),
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(ctx, user._id, { type: "item_saved", title: "Saved", detail: sourceUrl ?? rawText?.slice(0, 80) ?? "Image", itemId });
    await ctx.scheduler.runAfter(0, internal.ingest.run, { itemId });
    return itemId;
  },
});

/** Newest-first saves, optionally filtered by primary type. Empty for unknown owners. */
export const list = query({
  args: { ownerId: vOwnerId, primaryType: v.optional(vContentType), limit: v.optional(v.number()) },
  handler: async (ctx, { ownerId, primaryType, limit }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return [];
    const take = Math.min(limit ?? LIMITS.listDefault, LIMITS.listMax);
    const rows = primaryType
      ? await ctx.db
          .query("savedItems")
          .withIndex("by_userId_and_primaryType_and_createdAt", (q) => q.eq("userId", user._id).eq("primaryType", primaryType))
          .order("desc")
          .take(take)
      : await ctx.db
          .query("savedItems")
          .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
          .order("desc")
          .take(take);
    return await Promise.all(rows.map((row) => toView(ctx, row)));
  },
});

/** Paginated newest-first saves, optionally filtered by primary type. Empty (done) page for unknown owners. */
export const listPage = query({
  args: { ownerId: vOwnerId, primaryType: v.optional(vContentType), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { ownerId, primaryType, paginationOpts }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return { page: [], isDone: true, continueCursor: "" };
    const result = primaryType
      ? await ctx.db
          .query("savedItems")
          .withIndex("by_userId_and_primaryType_and_createdAt", (q) => q.eq("userId", user._id).eq("primaryType", primaryType))
          .order("desc")
          .paginate(paginationOpts)
      : await ctx.db
          .query("savedItems")
          .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
          .order("desc")
          .paginate(paginationOpts);
    return { ...result, page: await Promise.all(result.page.map((row) => toView(ctx, row))) };
  },
});

/** Full-text search over title, summary, text, and URL. */
export const search = query({
  args: { ownerId: vOwnerId, query: v.string(), primaryType: v.optional(vContentType) },
  handler: async (ctx, args) => {
    const user = await getUser(ctx, args.ownerId);
    const text = args.query.trim().toLowerCase();
    if (!user || !text) return [];
    const rows = await ctx.db
      .query("savedItems")
      .withSearchIndex("search_text", (q) => {
        const base = q.search("searchText", text).eq("userId", user._id);
        return args.primaryType ? base.eq("primaryType", args.primaryType) : base;
      })
      .take(LIMITS.listDefault);
    return await Promise.all(rows.map((row) => toView(ctx, row)));
  },
});

export const get = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    const owned = await getOwnedItem(ctx, ownerId, itemId);
    return owned ? await toView(ctx, owned.item) : null;
  },
});

/** User edits: rename, or add text/link to an item that needs input. */
export const update = mutation({
  args: {
    ownerId: vOwnerId,
    itemId: v.id("savedItems"),
    title: v.optional(v.string()),
    rawText: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, item } = await requireOwnedItem(ctx, args.ownerId, args.itemId);
    const patch: Partial<Doc<"savedItems">> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title.trim().slice(0, LIMITS.titleMaxChars) || undefined;
    if (args.rawText !== undefined) {
      if (args.rawText.length > LIMITS.rawTextMaxChars) throw new ConvexError("Text is too long");
      patch.rawText = args.rawText.trim() || undefined;
    }
    if (args.sourceUrl !== undefined) {
      patch.sourceUrl = args.sourceUrl.trim() ? normalizeUrl(args.sourceUrl) : undefined;
      patch.sourcePlatform = patch.sourceUrl ? detectSourcePlatform(patch.sourceUrl) : "manual";
    }
    patch.searchText = buildSearchText({ ...item, ...patch });
    await ctx.db.patch("savedItems", item._id, patch);
    await logActivity(ctx, user._id, { type: "item_updated", title: "Updated", itemId: item._id });
    return null;
  },
});

/** Re-runs ingestion, e.g. after a failure or after the user added text/a screenshot. */
export const retry = mutation({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems"), imageStorageId: v.optional(v.id("_storage")) },
  handler: async (ctx, args) => {
    const { item } = await requireOwnedItem(ctx, args.ownerId, args.itemId);
    await ctx.db.patch("savedItems", item._id, {
      extractionStatus: "pending",
      extractionError: undefined,
      updatedAt: Date.now(),
      ...(args.imageStorageId ? { imageStorageId: args.imageStorageId } : {}),
    });
    await ctx.scheduler.runAfter(0, internal.ingest.run, { itemId: item._id });
    return null;
  },
});

/** Deletes the item, its uploaded image, and everything derived from it. */
export const remove = mutation({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    const { user, item } = await requireOwnedItem(ctx, ownerId, itemId);
    const derived = await Promise.all([
      ctx.db.query("contentAnalysis").withIndex("by_itemId", (q) => q.eq("itemId", itemId)).take(100),
      ctx.db.query("actionSuggestions").withIndex("by_itemId_and_rank", (q) => q.eq("itemId", itemId)).take(100),
      ctx.db.query("actionExecutions").withIndex("by_itemId_and_createdAt", (q) => q.eq("itemId", itemId)).take(100),
      ctx.db.query("actionResults").withIndex("by_itemId", (q) => q.eq("itemId", itemId)).take(100),
    ]);
    for (const doc of derived.flat()) await ctx.db.delete(doc._id);
    if (item.imageStorageId) await ctx.storage.delete(item.imageStorageId);
    await ctx.db.delete("savedItems", itemId);
    await logActivity(ctx, user._id, { type: "item_deleted", title: "Deleted", detail: item.title ?? item.sourceUrl });
    return null;
  },
});

/**
 * Persists a checklist (or steps) toggle on an action result. Lives here so
 * the UI has one stable path; D+E own every other actionResults write.
 */
export const setChecklistItem = mutation({
  args: {
    ownerId: vOwnerId,
    resultId: v.id("actionResults"),
    sectionIndex: v.number(),
    itemIndex: v.number(),
    checked: v.boolean(),
  },
  handler: async (ctx, { ownerId, resultId, sectionIndex, itemIndex, checked }) => {
    const user = await requireUser(ctx, ownerId);
    const row = await requireOwned(ctx, user, resultId);
    const section = row.result.sections[sectionIndex];
    if (section?.kind === "checklist" && section.items[itemIndex]) {
      section.items[itemIndex] = { ...section.items[itemIndex], checked };
    } else if (section?.kind === "steps" && section.steps[itemIndex]) {
      section.steps[itemIndex] = { ...section.steps[itemIndex], checked };
    } else {
      throw new ConvexError("Checklist item not found");
    }
    await ctx.db.patch("actionResults", resultId, { result: row.result, updatedAt: Date.now() });
    return null;
  },
});

/* ---------------- internal: for ingestion/analysis (B+C) ---------------- */

/** Raw item + image URL for server-side processing. */
export const getForProcessing = internalQuery({
  args: { itemId: v.id("savedItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item) return null;
    return { item, imageUrl: item.imageStorageId ? await ctx.storage.getUrl(item.imageStorageId) : null };
  },
});

/** Moves an item through the extraction lifecycle and stores understood fields. */
export const setExtraction = internalMutation({
  args: {
    itemId: v.id("savedItems"),
    extractionStatus: vExtractionStatus,
    extractionError: v.optional(v.string()),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    contentTypes: v.optional(v.array(vContentType)),
    primaryType: v.optional(vContentType),
    ...keyFactFields,
  },
  handler: async (ctx, { itemId, ...fields }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item) return null;
    const next = { ...item, ...fields };
    await ctx.db.patch("savedItems", itemId, {
      ...fields,
      extractionError: fields.extractionError,
      searchText: buildSearchText(next),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export type { Id };
