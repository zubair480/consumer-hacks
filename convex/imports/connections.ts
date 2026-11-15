import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { getUser, requireUser } from "../lib/auth";
import { vOwnerId } from "../lib/validators";
import { logImport, type ImportResult } from "./posts";
import { vImportPlatform } from "./schema";
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchBookmarksPage,
  fetchMe,
  generatePkce,
  refreshTokens,
  XApiError,
  xCredentials,
  xRedirectUri,
} from "./xClient";

// OWNER: Import thread (CONS-19). Connected import sources and the X bookmarks sync.
// Tokens stay in importConnections; public functions return only status fields.

const STATE_TTL_MS = 15 * 60 * 1000;
const MAX_SYNC_PAGES = 5;
const RETURN_URL = /^(exp|exps|zapy):\/\//i;

const vSourceView = v.object({
  platform: vImportPlatform,
  label: v.string(),
  comingSoon: v.boolean(),
  configured: v.boolean(),
  connected: v.boolean(),
  username: v.union(v.string(), v.null()),
  lastSyncedAt: v.union(v.number(), v.null()),
  lastSyncNew: v.union(v.number(), v.null()),
  lastSyncSkipped: v.union(v.number(), v.null()),
  lastError: v.union(v.string(), v.null()),
});

/** The Import screen's source list: X (real), Instagram and LinkedIn (coming soon). */
export const sources = query({
  args: { ownerId: vOwnerId },
  returns: v.array(vSourceView),
  handler: async (ctx, { ownerId }) => {
    const user = await getUser(ctx, ownerId);
    const x = user
      ? await ctx.db
          .query("importConnections")
          .withIndex("by_userId_and_platform", (q) => q.eq("userId", user._id).eq("platform", "x"))
          .unique()
      : null;
    const idle = { connected: false, username: null, lastSyncedAt: null, lastSyncNew: null, lastSyncSkipped: null, lastError: null };
    return [
      {
        platform: "x" as const,
        label: "X bookmarks",
        comingSoon: false,
        configured: xCredentials() !== null,
        ...(x
          ? {
              connected: true,
              username: x.username ?? null,
              lastSyncedAt: x.lastSyncedAt ?? null,
              lastSyncNew: x.lastSyncNew ?? null,
              lastSyncSkipped: x.lastSyncSkipped ?? null,
              lastError: x.lastError ?? null,
            }
          : idle),
      },
      { platform: "instagram" as const, label: "Instagram saved", comingSoon: true, configured: false, ...idle },
      { platform: "linkedin" as const, label: "LinkedIn saved", comingSoon: true, configured: false, ...idle },
    ];
  },
});

/** Starts X OAuth 2.0 (PKCE). Open authorizeUrl in an auth session that returns to returnUrl. */
export const startXConnect = action({
  args: { ownerId: vOwnerId, returnUrl: v.string() },
  returns: v.object({ authorizeUrl: v.string() }),
  handler: async (ctx, { ownerId, returnUrl }) => {
    const creds = xCredentials();
    if (!creds) throw new ConvexError("X import isn't set up on the server yet (X_CLIENT_ID is missing).");
    if (!RETURN_URL.test(returnUrl) || returnUrl.length > 500) throw new ConvexError("Invalid return URL");
    const { verifier, challenge } = await generatePkce();
    const state = crypto.randomUUID();
    await ctx.runMutation(internal.imports.connections.saveOAuthState, { ownerId, state, codeVerifier: verifier, returnUrl });
    return { authorizeUrl: buildAuthorizeUrl({ clientId: creds.clientId, redirectUri: xRedirectUri(), state, codeChallenge: challenge }) };
  },
});

export const saveOAuthState = internalMutation({
  args: { ownerId: vOwnerId, state: v.string(), codeVerifier: v.string(), returnUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, { ownerId, ...rest }) => {
    const user = await requireUser(ctx, ownerId);
    await ctx.db.insert("importOAuthStates", { userId: user._id, platform: "x", createdAt: Date.now(), ...rest });
    return null;
  },
});

export const consumeOAuthState = internalMutation({
  args: { state: v.string() },
  returns: v.union(v.null(), v.object({ userId: v.id("users"), codeVerifier: v.string(), returnUrl: v.string(), expired: v.boolean() })),
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("importOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (!row) return null;
    await ctx.db.delete("importOAuthStates", row._id);
    return { userId: row.userId, codeVerifier: row.codeVerifier, returnUrl: row.returnUrl, expired: Date.now() - row.createdAt > STATE_TTL_MS };
  },
});

export const saveXConnection = internalMutation({
  args: {
    userId: v.id("users"),
    externalUserId: v.string(),
    username: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { userId, ...fields }) => {
    const existing = await ctx.db
      .query("importConnections")
      .withIndex("by_userId_and_platform", (q) => q.eq("userId", userId).eq("platform", "x"))
      .unique();
    const now = Date.now();
    if (existing) await ctx.db.patch("importConnections", existing._id, { ...fields, lastError: undefined, updatedAt: now });
    else await ctx.db.insert("importConnections", { userId, platform: "x", ...fields, createdAt: now, updatedAt: now });
    return null;
  },
});

/** Called by the /oauth/x/callback HTTP route. Returns where to send the browser. */
export const completeXConnect = internalAction({
  args: { state: v.string(), code: v.optional(v.string()), error: v.optional(v.string()) },
  returns: v.union(v.null(), v.object({ returnUrl: v.string(), ok: v.boolean(), message: v.optional(v.string()) })),
  handler: async (ctx, { state, code, error }): Promise<{ returnUrl: string; ok: boolean; message?: string } | null> => {
    const pending: { userId: Id<"users">; codeVerifier: string; returnUrl: string; expired: boolean } | null = await ctx.runMutation(internal.imports.connections.consumeOAuthState, { state });
    if (!pending) return null;
    const { returnUrl } = pending;
    if (error || !code) return { returnUrl, ok: false, message: error === "access_denied" ? "You cancelled the X connection." : "X did not return a code." };
    if (pending.expired) return { returnUrl, ok: false, message: "That X sign-in took too long. Try again." };
    const creds = xCredentials();
    if (!creds) return { returnUrl, ok: false, message: "X import isn't set up on the server yet." };
    try {
      const tokens = await exchangeCode({ code, codeVerifier: pending.codeVerifier, redirectUri: xRedirectUri() }, creds);
      const me = await fetchMe(tokens.accessToken);
      await ctx.runMutation(internal.imports.connections.saveXConnection, {
        userId: pending.userId,
        externalUserId: me.id,
        username: me.username,
        ...tokens,
      });
      return { returnUrl, ok: true };
    } catch (e) {
      console.error("X connect failed", e instanceof Error ? e.message : e);
      return { returnUrl, ok: false, message: e instanceof Error ? e.message.slice(0, 200) : "X connect failed" };
    }
  },
});

export const disconnect = mutation({
  args: { ownerId: vOwnerId, platform: vImportPlatform },
  returns: v.null(),
  handler: async (ctx, { ownerId, platform }) => {
    const user = await requireUser(ctx, ownerId);
    const row = await ctx.db
      .query("importConnections")
      .withIndex("by_userId_and_platform", (q) => q.eq("userId", user._id).eq("platform", platform))
      .unique();
    if (row) await ctx.db.delete("importConnections", row._id);
    return null;
  },
});

export const getXConnection = internalQuery({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }): Promise<Doc<"importConnections"> | null> => {
    const user = await requireUser(ctx, ownerId);
    return await ctx.db
      .query("importConnections")
      .withIndex("by_userId_and_platform", (q) => q.eq("userId", user._id).eq("platform", "x"))
      .unique();
  },
});

export const updateTokens = internalMutation({
  args: {
    connectionId: v.id("importConnections"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { connectionId, ...tokens }) => {
    await ctx.db.patch("importConnections", connectionId, { ...tokens, updatedAt: Date.now() });
    return null;
  },
});

export const recordSync = internalMutation({
  args: {
    connectionId: v.id("importConnections"),
    created: v.number(),
    duplicates: v.number(),
    invalid: v.number(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { connectionId, error, ...result }) => {
    const row = await ctx.db.get("importConnections", connectionId);
    if (!row) return null;
    const now = Date.now();
    await ctx.db.patch("importConnections", connectionId, {
      lastSyncedAt: now,
      lastSyncNew: result.created,
      lastSyncSkipped: result.duplicates,
      lastError: error,
      updatedAt: now,
    });
    if (!error || result.created) await logImport(ctx, row.userId, "X", result);
    return null;
  },
});

/**
 * Pulls X bookmarks (newest first, up to 500) into Zapy. Stops paging once a whole page is
 * already imported, so routine syncs cost one request.
 */
export const syncX = action({
  args: { ownerId: vOwnerId },
  returns: v.object({ created: v.number(), duplicates: v.number(), invalid: v.number() }),
  handler: async (ctx, { ownerId }): Promise<ImportResult> => {
    const connection: Doc<"importConnections"> | null = await ctx.runQuery(internal.imports.connections.getXConnection, { ownerId });
    if (!connection) throw new ConvexError("Connect X first.");
    const creds = xCredentials();
    if (!creds) throw new ConvexError("X import isn't set up on the server yet (X_CLIENT_ID is missing).");

    const total: ImportResult = { created: 0, duplicates: 0, invalid: 0 };
    let error: string | undefined;
    try {
      let accessToken = connection.accessToken;
      if (connection.expiresAt < Date.now() + 60_000) {
        if (!connection.refreshToken) throw new XApiError("X access expired. Reconnect X.", 401);
        const tokens = await refreshTokens(connection.refreshToken, creds);
        await ctx.runMutation(internal.imports.connections.updateTokens, { connectionId: connection._id, ...tokens });
        accessToken = tokens.accessToken;
      }
      let token: string | undefined;
      for (let page = 0; page < MAX_SYNC_PAGES; page++) {
        const { posts, nextToken } = await fetchBookmarksPage(accessToken, connection.externalUserId, token);
        if (posts.length) {
          const result: ImportResult = await ctx.runMutation(internal.imports.posts.importForUser, { userId: connection.userId, posts });
          total.created += result.created;
          total.duplicates += result.duplicates;
          total.invalid += result.invalid;
          if (result.created === 0) break;
        }
        if (!nextToken) break;
        token = nextToken;
      }
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 300) : "X sync failed";
      console.error("X sync failed", error);
    }
    await ctx.runMutation(internal.imports.connections.recordSync, { connectionId: connection._id, ...total, error });
    if (error && total.created === 0) throw new ConvexError(error);
    return total;
  },
});
