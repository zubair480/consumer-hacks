import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalMutation, internalQuery, query } from "../_generated/server";
import { getUser, requireUser } from "../lib/auth";
import { vOwnerId } from "../lib/validators";
import { fetchStarredPage, GitHubApiError, normalizeUsername } from "./githubClient";
import { logImport, type ImportResult } from "./posts";

// OWNER: GitHub stars import thread (ZUB-19). Imports a GitHub user's starred repos through
// the shared import pipeline. No OAuth: stars are public, so a saved username is enough.

export const MAX_NEW_PER_SYNC = 20;
const MAX_PAGES = 5;

/** The saved GitHub username and last sync result for the Import screen. */
export const status = query({
  args: { ownerId: vOwnerId },
  returns: v.union(
    v.null(),
    v.object({
      username: v.string(),
      lastSyncedAt: v.union(v.number(), v.null()),
      lastSyncNew: v.union(v.number(), v.null()),
      lastSyncSkipped: v.union(v.number(), v.null()),
      lastError: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { ownerId }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return null;
    const row = await ctx.db
      .query("githubImportAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (!row) return null;
    return {
      username: row.username,
      lastSyncedAt: row.lastSyncedAt ?? null,
      lastSyncNew: row.lastSyncNew ?? null,
      lastSyncSkipped: row.lastSyncSkipped ?? null,
      lastError: row.lastError ?? null,
    };
  },
});

export const getAccount = internalQuery({
  args: { ownerId: vOwnerId },
  returns: v.object({ userId: v.id("users"), username: v.union(v.string(), v.null()) }),
  handler: async (ctx, { ownerId }) => {
    const user = await requireUser(ctx, ownerId);
    const row = await ctx.db
      .query("githubImportAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    return { userId: user._id, username: row?.username ?? null };
  },
});

export const recordSync = internalMutation({
  args: { userId: v.id("users"), username: v.string(), created: v.number(), duplicates: v.number(), invalid: v.number(), error: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { userId, username, error, ...result }) => {
    const now = Date.now();
    const fields = { username, lastSyncedAt: now, lastSyncNew: result.created, lastSyncSkipped: result.duplicates, lastError: error, updatedAt: now };
    const existing = await ctx.db
      .query("githubImportAccounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) await ctx.db.patch("githubImportAccounts", existing._id, fields);
    else await ctx.db.insert("githubImportAccounts", { userId, ...fields, createdAt: now });
    if (!error || result.created) await logImport(ctx, userId, "GitHub stars", result);
    return null;
  },
});

/**
 * Imports up to MAX_NEW_PER_SYNC new stars, newest first. Pass username to set or change it;
 * omit it to reuse the saved one. A username GitHub doesn't know is never saved.
 */
export const sync = action({
  args: { ownerId: vOwnerId, username: v.optional(v.string()) },
  returns: v.object({ created: v.number(), duplicates: v.number(), invalid: v.number() }),
  handler: async (ctx, args): Promise<ImportResult> => {
    const account: { userId: Id<"users">; username: string | null } = await ctx.runQuery(internal.imports.github.getAccount, { ownerId: args.ownerId });
    const raw = args.username ?? account.username;
    if (!raw) throw new ConvexError("Enter your GitHub username first.");
    const username = normalizeUsername(raw);
    if (!username) throw new ConvexError(`"${raw.trim()}" isn't a valid GitHub username.`);

    const total: ImportResult = { created: 0, duplicates: 0, invalid: 0 };
    let error: string | undefined;
    try {
      for (let page = 1; page <= MAX_PAGES && total.created < MAX_NEW_PER_SYNC; page++) {
        const { stars, hasMore } = await fetchStarredPage(username, page);
        let createdThisPage = 0;
        let offset = 0;
        while (offset < stars.length && total.created < MAX_NEW_PER_SYNC) {
          const chunk = stars.slice(offset, offset + MAX_NEW_PER_SYNC - total.created);
          offset += chunk.length;
          const result: ImportResult = await ctx.runMutation(internal.imports.posts.importForUser, { userId: account.userId, posts: chunk });
          total.created += result.created;
          total.duplicates += result.duplicates;
          total.invalid += result.invalid;
          createdThisPage += result.created;
        }
        if (!hasMore || (stars.length && createdThisPage === 0)) break;
      }
    } catch (e) {
      if (e instanceof GitHubApiError && e.status === 404 && total.created === 0) throw new ConvexError(e.message);
      error = e instanceof Error ? e.message.slice(0, 300) : "GitHub sync failed";
      console.error("GitHub stars sync failed", error);
    }
    await ctx.runMutation(internal.imports.github.recordSync, { userId: account.userId, username, ...total, error });
    if (error && total.created === 0) throw new ConvexError(error);
    return total;
  },
});
