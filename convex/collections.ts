import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { LIMITS, type CollectionKind } from "../src/shared/contracts";
import { ensureUser, getUser, requireOwned, requireOwnedItem, requireUser } from "./lib/auth";
import { vCollectionKind, vOwnerId } from "./lib/validators";
import { logEvent } from "./activity";

// OWNER: F. Collections (Moodboard and user collections). Membership lives in
// savedItems.collectionIds; a collection's items are read from the owner's
// newest 200 saves.

export const MOODBOARD_NAME = "Moodboard";
const NAME_MAX = 60;

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, NAME_MAX);
  if (!trimmed) throw new ConvexError("Collection name can't be empty");
  return trimmed;
}

async function userCollections(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("collections")
    .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(LIMITS.listMax);
}

async function recentItems(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("savedItems")
    .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(LIMITS.listMax);
}

export async function getOrCreateCollection(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: CollectionKind,
  name: string,
): Promise<Id<"collections">> {
  const existing = (await userCollections(ctx, userId)).find(
    (c) => c.kind === kind && c.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return existing._id;
  const now = Date.now();
  return await ctx.db.insert("collections", { userId, name, kind, createdAt: now, updatedAt: now });
}

/** Adds an item to a collection the same user owns; idempotent. Logs collection_updated. */
export async function addItemToCollection(ctx: MutationCtx, item: Doc<"savedItems">, collection: Doc<"collections">): Promise<void> {
  if (item.userId !== collection.userId) throw new ConvexError("Not found");
  const ids = item.collectionIds ?? [];
  const now = Date.now();
  if (!ids.includes(collection._id)) {
    await ctx.db.patch("savedItems", item._id, { collectionIds: [...ids, collection._id], updatedAt: now });
  }
  await ctx.db.patch("collections", collection._id, { updatedAt: now, coverItemId: collection.coverItemId ?? item._id });
  await logEvent(ctx, item.userId, {
    type: "collection_updated",
    title: `Added to ${collection.name}`,
    detail: item.title ?? item.sourceUrl,
    itemId: item._id,
    collectionId: collection._id,
  });
}

/** For D+E's add_to_moodboard executor (inside a mutation). */
export async function addItemToMoodboard(ctx: MutationCtx, item: Doc<"savedItems">): Promise<Id<"collections">> {
  const collectionId = await getOrCreateCollection(ctx, item.userId, "moodboard", MOODBOARD_NAME);
  await addItemToCollection(ctx, item, (await ctx.db.get("collections", collectionId))!);
  return collectionId;
}

export const getOrCreateMoodboard = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => await getOrCreateCollection(ctx, userId, "moodboard", MOODBOARD_NAME),
});

export const addToMoodboard = internalMutation({
  args: { itemId: v.id("savedItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item) throw new ConvexError("Not found");
    return await addItemToMoodboard(ctx, item);
  },
});

/** The owner's collections, newest first, with item counts (counted over the newest 200 saves). */
export const list = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return [];
    const [collections, items] = await Promise.all([userCollections(ctx, user._id), recentItems(ctx, user._id)]);
    return await Promise.all(
      collections.map(async (c) => {
        const cover = c.coverItemId ? await ctx.db.get("savedItems", c.coverItemId) : null;
        return {
          _id: c._id,
          name: c.name,
          kind: c.kind,
          description: c.description ?? null,
          itemCount: items.filter((i) => i.collectionIds?.includes(c._id)).length,
          coverImageUrl: cover?.imageStorageId ? await ctx.storage.getUrl(cover.imageStorageId) : null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      }),
    );
  },
});

/** One collection and its items (newest first). */
export const get = query({
  args: { ownerId: vOwnerId, collectionId: v.id("collections") },
  handler: async (ctx, { ownerId, collectionId }) => {
    const user = await requireUser(ctx, ownerId);
    const c = await requireOwned(ctx, user, collectionId);
    const items = (await recentItems(ctx, user._id)).filter((i) => i.collectionIds?.includes(c._id));
    return {
      _id: c._id,
      name: c.name,
      kind: c.kind,
      description: c.description ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      items: await Promise.all(
        items.map(async (i) => ({
          _id: i._id,
          title: i.title ?? null,
          summary: i.summary ?? null,
          sourceUrl: i.sourceUrl ?? null,
          primaryType: i.primaryType ?? null,
          extractionStatus: i.extractionStatus,
          imageUrl: i.imageStorageId ? await ctx.storage.getUrl(i.imageStorageId) : null,
          createdAt: i.createdAt,
        })),
      ),
    };
  },
});

export const create = mutation({
  args: { ownerId: vOwnerId, name: v.string(), kind: v.optional(vCollectionKind), description: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.ownerId);
    const name = cleanName(args.name);
    const existing = await userCollections(ctx, user._id);
    if (existing.length >= LIMITS.listMax) throw new ConvexError("Too many collections");
    if (existing.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new ConvexError("A collection with that name exists");
    const now = Date.now();
    const collectionId = await ctx.db.insert("collections", {
      userId: user._id,
      name,
      kind: args.kind ?? "custom",
      description: args.description?.trim().slice(0, 300) || undefined,
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, user._id, { type: "collection_updated", title: `Created ${name}`, collectionId });
    return collectionId;
  },
});

export const rename = mutation({
  args: { ownerId: vOwnerId, collectionId: v.id("collections"), name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.ownerId);
    const c = await requireOwned(ctx, user, args.collectionId);
    const name = cleanName(args.name);
    const clash = (await userCollections(ctx, user._id)).some((o) => o._id !== c._id && o.name.toLowerCase() === name.toLowerCase());
    if (clash) throw new ConvexError("A collection with that name exists");
    await ctx.db.patch("collections", c._id, { name, updatedAt: Date.now() });
    await logEvent(ctx, user._id, { type: "collection_updated", title: `Renamed to ${name}`, detail: c.name, collectionId: c._id });
    return null;
  },
});

/** Deletes the collection and removes it from its items (the items stay saved). */
export const remove = mutation({
  args: { ownerId: vOwnerId, collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.ownerId);
    const c = await requireOwned(ctx, user, args.collectionId);
    for (const item of await recentItems(ctx, user._id)) {
      if (item.collectionIds?.includes(c._id)) {
        await ctx.db.patch("savedItems", item._id, { collectionIds: item.collectionIds.filter((id) => id !== c._id) });
      }
    }
    await ctx.db.delete("collections", c._id);
    await logEvent(ctx, user._id, { type: "collection_updated", title: `Deleted ${c.name}` });
    return null;
  },
});

export const addItem = mutation({
  args: { ownerId: vOwnerId, collectionId: v.id("collections"), itemId: v.id("savedItems") },
  handler: async (ctx, args) => {
    const { user, item } = await requireOwnedItem(ctx, args.ownerId, args.itemId);
    const c = await requireOwned(ctx, user, args.collectionId);
    await addItemToCollection(ctx, item, c);
    return null;
  },
});

export const removeItem = mutation({
  args: { ownerId: vOwnerId, collectionId: v.id("collections"), itemId: v.id("savedItems") },
  handler: async (ctx, args) => {
    const { user, item } = await requireOwnedItem(ctx, args.ownerId, args.itemId);
    const c = await requireOwned(ctx, user, args.collectionId);
    if (!item.collectionIds?.includes(c._id)) return null;
    const now = Date.now();
    await ctx.db.patch("savedItems", item._id, { collectionIds: item.collectionIds.filter((id) => id !== c._id), updatedAt: now });
    await ctx.db.patch("collections", c._id, {
      updatedAt: now,
      coverItemId: c.coverItemId === item._id ? undefined : c.coverItemId,
    });
    await logEvent(ctx, user._id, {
      type: "collection_updated",
      title: `Removed from ${c.name}`,
      detail: item.title ?? item.sourceUrl,
      itemId: item._id,
      collectionId: c._id,
    });
    return null;
  },
});
