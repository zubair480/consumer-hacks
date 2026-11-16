import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireUser } from "../lib/auth";
import { vOwnerId } from "../lib/validators";

/** Schedules every import sync the owner has set up: X bookmarks when X is connected, GitHub stars when a username is saved. */
export async function scheduleImportSyncs(ctx: MutationCtx, userId: Id<"users">, ownerId: string): Promise<string[]> {
  const scheduled: string[] = [];
  const x = await ctx.db
    .query("importConnections")
    .withIndex("by_userId_and_platform", (q) => q.eq("userId", userId).eq("platform", "x"))
    .unique();
  if (x) {
    await ctx.scheduler.runAfter(0, api.imports.connections.syncX, { ownerId });
    scheduled.push("x");
  }
  const github = await ctx.db
    .query("githubImportAccounts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (github?.username) {
    await ctx.scheduler.runAfter(0, api.imports.github.sync, { ownerId });
    scheduled.push("github");
  }
  return scheduled;
}

/** Home refresh: runs the same server-side syncs as Pull everything, without seeding. New saves arrive through items.list. */
export const syncAll = mutation({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await requireUser(ctx, ownerId);
    return { scheduled: await scheduleImportSyncs(ctx, user._id, ownerId) };
  },
});
