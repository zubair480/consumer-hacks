import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

// Background jobs scheduled from convex/crons.ts: read-only auto-sync of connected import
// sources, and re-queueing of items whose ingestion stalled.

export const STUCK_AFTER_MS = 10 * 60 * 1000;
export const MAX_INGEST_RETRIES = 2;
export const SYNC_OWNER_BATCH = 5;
const STUCK_STATUSES = ["pending", "extracting", "analyzing"];
const SCAN_LIMIT = 300;

export function isStuck(item: Pick<Doc<"savedItems">, "extractionStatus" | "updatedAt" | "ingestRetries">, now: number): boolean {
  return STUCK_STATUSES.includes(item.extractionStatus) && now - item.updatedAt > STUCK_AFTER_MS && (item.ingestRetries ?? 0) < MAX_INGEST_RETRIES;
}

export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Reschedules ingestion for items still in flight past the threshold, at most MAX_INGEST_RETRIES times each. Ready, failed and needs_input items are never touched. */
export const requeueStuck = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const recent = await ctx.db.query("savedItems").order("desc").take(SCAN_LIMIT);
    const stuck = recent.filter((item) => isStuck(item, now));
    for (const item of stuck) {
      await ctx.db.patch("savedItems", item._id, { extractionStatus: "pending", ingestRetries: (item.ingestRetries ?? 0) + 1, updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.ingest.run, { itemId: item._id });
    }
    return stuck.length;
  },
});

type SyncPlatform = "x" | "youtube" | "github";

/** Owners with at least one connected source: X and YouTube connections, GitHub with a saved username. */
export const listSyncTargets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const byUser = new Map<string, Set<SyncPlatform>>();
    const add = (userId: string, platform: SyncPlatform) => byUser.set(userId, (byUser.get(userId) ?? new Set()).add(platform));
    for (const c of await ctx.db.query("importConnections").take(1000)) {
      if (c.platform === "x" || c.platform === "youtube") add(c.userId, c.platform);
    }
    for (const g of await ctx.db.query("githubImportAccounts").take(1000)) add(g.userId, "github");
    const targets: { ownerId: string; platforms: SyncPlatform[] }[] = [];
    for (const [userId, platforms] of byUser) {
      const user = await ctx.db.get("users", userId as Doc<"users">["_id"]);
      if (user) targets.push({ ownerId: user.ownerId, platforms: [...platforms] });
    }
    return targets;
  },
});

/** Syncs one owner's sources one after another; a failing source never blocks the rest. */
export const syncOwner = internalAction({
  args: { ownerId: v.string(), platforms: v.array(v.union(v.literal("x"), v.literal("youtube"), v.literal("github"))) },
  returns: v.number(),
  handler: async (ctx, { ownerId, platforms }) => {
    let failures = 0;
    for (const platform of platforms) {
      try {
        if (platform === "x") await ctx.runAction(api.imports.connections.syncX, { ownerId });
        else if (platform === "youtube") await ctx.runAction(api.imports.youtube.sync, { ownerId });
        else await ctx.runAction(api.imports.github.sync, { ownerId });
      } catch (e) {
        failures++;
        console.error("auto-sync failed", platform, e instanceof Error ? e.message : e);
      }
    }
    return failures;
  },
});

/** Cron entry: syncs every connected owner in small parallel batches. */
export const syncAllSources = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const targets: { ownerId: string; platforms: SyncPlatform[] }[] = await ctx.runQuery(internal.maintenance.listSyncTargets, {});
    for (const batch of chunk(targets, SYNC_OWNER_BATCH)) {
      await Promise.allSettled(batch.map((t) => ctx.runAction(internal.maintenance.syncOwner, t)));
    }
    return null;
  },
});
