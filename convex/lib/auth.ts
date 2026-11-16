import { ConvexError } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// OWNER: Lead. Ownership helpers. Every public query/mutation takes
// `ownerId` (device UUID) and resolves it through these helpers.
// Actions have no ctx.db: call an internal query that uses them.

const OWNER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertOwnerId(ownerId: string): void {
  if (!OWNER_ID_PATTERN.test(ownerId)) throw new ConvexError("Invalid ownerId");
}

/** The user row for an ownerId, or null if this device never called users.ensure. */
export async function getUser(ctx: QueryCtx, ownerId: string): Promise<Doc<"users"> | null> {
  assertOwnerId(ownerId);
  return await ctx.db
    .query("users")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", ownerId))
    .unique();
}

/** Like getUser, but throws when the user does not exist. */
export async function requireUser(ctx: QueryCtx, ownerId: string): Promise<Doc<"users">> {
  const user = await getUser(ctx, ownerId);
  if (!user) throw new ConvexError("Unknown owner");
  return user;
}

/** Gets or creates the user row for an ownerId. Mutations only. */
export async function ensureUser(ctx: MutationCtx, ownerId: string): Promise<Doc<"users">> {
  const existing = await getUser(ctx, ownerId);
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("users", { ownerId, createdAt: now, lastSeenAt: now });
  return (await ctx.db.get(id))!;
}

type UserOwnedTable = Exclude<TableNames, "users">;

/**
 * Loads a document from any user-owned table and checks it belongs to user.
 * Throws "Not found" for both missing and foreign documents so ids of other
 * users' data are not distinguishable.
 */
export async function requireOwned<T extends UserOwnedTable>(
  ctx: QueryCtx,
  user: Doc<"users">,
  id: Id<T>,
): Promise<Doc<T>> {
  const doc = (await ctx.db.get(id)) as (Doc<T> & { userId: Id<"users"> }) | null;
  if (!doc || doc.userId !== user._id) throw new ConvexError("Not found");
  return doc;
}

/** Resolves ownerId + itemId in one call: the common case for item-scoped functions. */
export async function requireOwnedItem(
  ctx: QueryCtx,
  ownerId: string,
  itemId: Id<"savedItems">,
): Promise<{ user: Doc<"users">; item: Doc<"savedItems"> }> {
  const user = await requireUser(ctx, ownerId);
  const item = await requireOwned(ctx, user, itemId);
  return { user, item };
}

/** Like requireOwned, but null when the document is missing or not the user's. For queries a live screen may re-run after a delete. */
export async function getOwned<T extends UserOwnedTable>(ctx: QueryCtx, user: Doc<"users">, id: Id<T>): Promise<Doc<T> | null> {
  const doc = (await ctx.db.get(id)) as (Doc<T> & { userId: Id<"users"> }) | null;
  return doc && doc.userId === user._id ? doc : null;
}

/** Like requireOwnedItem, but null when the item is missing or not owned. An unknown owner still throws. Queries only. */
export async function getOwnedItem(
  ctx: QueryCtx,
  ownerId: string,
  itemId: Id<"savedItems">,
): Promise<{ user: Doc<"users">; item: Doc<"savedItems"> } | null> {
  const user = await requireUser(ctx, ownerId);
  const item = await getOwned(ctx, user, itemId);
  return item ? { user, item } : null;
}
