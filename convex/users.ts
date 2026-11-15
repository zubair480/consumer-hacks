import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ensureUser, getUser } from "./lib/auth";
import { vOwnerId } from "./lib/validators";

// OWNER: Lead.

/** Called once on app start by OwnerProvider; creates the users row if needed. */
export const ensure = mutation({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await ensureUser(ctx, ownerId);
    await ctx.db.patch("users", user._id, { lastSeenAt: Date.now() });
    return user._id;
  },
});

export const me = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return null;
    return { _id: user._id, displayName: user.displayName ?? null, createdAt: user.createdAt };
  },
});

export const setDisplayName = mutation({
  args: { ownerId: vOwnerId, displayName: v.string() },
  handler: async (ctx, { ownerId, displayName }) => {
    const user = await ensureUser(ctx, ownerId);
    await ctx.db.patch("users", user._id, { displayName: displayName.trim().slice(0, 80) || undefined });
    return null;
  },
});
