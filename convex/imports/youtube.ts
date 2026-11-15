import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, query } from "../_generated/server";
import { getUser, requireUser } from "../lib/auth";
import { requireSyncSlot } from "../lib/rateLimits";
import { vOwnerId } from "../lib/validators";
import { logImport, type ImportResult } from "./posts";
import { generatePkce } from "./xClient";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchLikedVideosPage,
  fetchMyChannel,
  GoogleApiError,
  googleCredentials,
  googleRedirectUri,
  refreshGoogleTokens,
} from "./youtubeClient";

// OWNER: YouTube import thread (ZUB-20). Google OAuth connect and the YouTube liked-videos sync.
// Tokens stay in importConnections; public functions return only status fields.

const STATE_TTL_MS = 15 * 60 * 1000;
export const MAX_NEW_PER_SYNC = 20;
const MAX_SYNC_PAGES = 5;
const RETURN_URL = /^(exp|exps|zapy):\/\//i;
const NOT_CONFIGURED = "YouTube import isn't set up on the server yet (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing).";

/** The YouTube row on the Import screen. */
export const status = query({
  args: { ownerId: vOwnerId },
  returns: v.object({
    configured: v.boolean(),
    connected: v.boolean(),
    channelTitle: v.union(v.string(), v.null()),
    lastSyncedAt: v.union(v.number(), v.null()),
    lastSyncNew: v.union(v.number(), v.null()),
    lastSyncSkipped: v.union(v.number(), v.null()),
    lastError: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, { ownerId }) => {
    const user = await getUser(ctx, ownerId);
    const row = user
      ? await ctx.db
          .query("importConnections")
          .withIndex("by_userId_and_platform", (q) => q.eq("userId", user._id).eq("platform", "youtube"))
          .unique()
      : null;
    return {
      configured: googleCredentials() !== null,
      connected: row !== null,
      channelTitle: row?.username ?? null,
      lastSyncedAt: row?.lastSyncedAt ?? null,
      lastSyncNew: row?.lastSyncNew ?? null,
      lastSyncSkipped: row?.lastSyncSkipped ?? null,
      lastError: row?.lastError ?? null,
    };
  },
});

/** Starts Google OAuth. Open authorizeUrl in an auth session that returns to returnUrl. */
export const startConnect = action({
  args: { ownerId: vOwnerId, returnUrl: v.string() },
  returns: v.object({ authorizeUrl: v.string() }),
  handler: async (ctx, { ownerId, returnUrl }) => {
    const creds = googleCredentials();
    if (!creds) throw new ConvexError(NOT_CONFIGURED);
    if (!RETURN_URL.test(returnUrl) || returnUrl.length > 500) throw new ConvexError("Invalid return URL");
    const { verifier, challenge } = await generatePkce();
    const state = crypto.randomUUID();
    await ctx.runMutation(internal.imports.youtube.saveState, { ownerId, state, codeVerifier: verifier, returnUrl });
    return { authorizeUrl: buildGoogleAuthorizeUrl({ clientId: creds.clientId, redirectUri: googleRedirectUri(), state, codeChallenge: challenge }) };
  },
});

export const saveState = internalMutation({
  args: { ownerId: vOwnerId, state: v.string(), codeVerifier: v.string(), returnUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, { ownerId, ...rest }) => {
    const user = await requireUser(ctx, ownerId);
    await ctx.db.insert("importOAuthStates", { userId: user._id, platform: "youtube", createdAt: Date.now(), ...rest });
    return null;
  },
});

/** Single use: the state row is deleted on first read. A state minted for another platform is left alone. */
export const consumeState = internalMutation({
  args: { state: v.string() },
  returns: v.union(v.null(), v.object({ userId: v.id("users"), codeVerifier: v.string(), returnUrl: v.string(), expired: v.boolean() })),
  handler: async (ctx, { state }) => {
    const row = await ctx.db
      .query("importOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", state))
      .unique();
    if (!row || row.platform !== "youtube") return null;
    await ctx.db.delete("importOAuthStates", row._id);
    return { userId: row.userId, codeVerifier: row.codeVerifier, returnUrl: row.returnUrl, expired: Date.now() - row.createdAt > STATE_TTL_MS };
  },
});

export const saveConnection = internalMutation({
  args: {
    userId: v.id("users"),
    externalUserId: v.string(),
    username: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { userId, ...fields }) => {
    const existing = await ctx.db
      .query("importConnections")
      .withIndex("by_userId_and_platform", (q) => q.eq("userId", userId).eq("platform", "youtube"))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch("importConnections", existing._id, {
        ...fields,
        refreshToken: fields.refreshToken ?? existing.refreshToken,
        lastError: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("importConnections", { userId, platform: "youtube", ...fields, createdAt: now, updatedAt: now });
    }
    return null;
  },
});

type CallbackOutcome = { returnUrl: string; ok: boolean; message?: string };

/** Called by the /oauth/google/callback HTTP route. Returns where to send the browser. */
export const completeConnect = internalAction({
  args: { state: v.string(), code: v.optional(v.string()), error: v.optional(v.string()) },
  returns: v.union(v.null(), v.object({ returnUrl: v.string(), ok: v.boolean(), message: v.optional(v.string()) })),
  handler: async (ctx, { state, code, error }): Promise<CallbackOutcome | null> => {
    const pending: { userId: Id<"users">; codeVerifier: string; returnUrl: string; expired: boolean } | null = await ctx.runMutation(
      internal.imports.youtube.consumeState,
      { state },
    );
    if (!pending) return null;
    const { returnUrl } = pending;
    if (error || !code) return { returnUrl, ok: false, message: error === "access_denied" ? "You cancelled the YouTube connection." : "Google did not return a code." };
    if (pending.expired) return { returnUrl, ok: false, message: "That Google sign-in took too long. Try again." };
    const creds = googleCredentials();
    if (!creds) return { returnUrl, ok: false, message: NOT_CONFIGURED };
    try {
      const tokens = await exchangeGoogleCode({ code, codeVerifier: pending.codeVerifier, redirectUri: googleRedirectUri() }, creds);
      const channel = await fetchMyChannel(tokens.accessToken);
      await ctx.runMutation(internal.imports.youtube.saveConnection, {
        userId: pending.userId,
        externalUserId: channel?.id ?? "me",
        username: channel?.title || undefined,
        ...tokens,
      });
      return { returnUrl, ok: true };
    } catch (e) {
      console.error("YouTube connect failed", e instanceof Error ? e.message : e);
      return { returnUrl, ok: false, message: e instanceof Error ? e.message.slice(0, 200) : "YouTube connect failed" };
    }
  },
});

export const getConnection = internalQuery({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }): Promise<Doc<"importConnections"> | null> => {
    const user = await requireUser(ctx, ownerId);
    return await ctx.db
      .query("importConnections")
      .withIndex("by_userId_and_platform", (q) => q.eq("userId", user._id).eq("platform", "youtube"))
      .unique();
  },
});

export const updateAccessToken = internalMutation({
  args: { connectionId: v.id("importConnections"), accessToken: v.string(), refreshToken: v.optional(v.string()), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { connectionId, refreshToken, ...tokens }) => {
    await ctx.db.patch("importConnections", connectionId, { ...tokens, ...(refreshToken ? { refreshToken } : {}), updatedAt: Date.now() });
    return null;
  },
});

export const recordSync = internalMutation({
  args: { connectionId: v.id("importConnections"), created: v.number(), duplicates: v.number(), invalid: v.number(), error: v.optional(v.string()) },
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
    if (!error || result.created) await logImport(ctx, row.userId, "YouTube", result);
    return null;
  },
});

/**
 * Pulls liked videos (newest first) into Zapy, at most MAX_NEW_PER_SYNC new items per sync.
 * Stops paging once a page has nothing new, so routine syncs cost one API request.
 */
export const sync = action({
  args: { ownerId: vOwnerId },
  returns: v.object({ created: v.number(), duplicates: v.number(), invalid: v.number() }),
  handler: async (ctx, { ownerId }): Promise<ImportResult> => {
    const connection: Doc<"importConnections"> | null = await ctx.runQuery(internal.imports.youtube.getConnection, { ownerId });
    if (!connection) throw new ConvexError("Connect YouTube first.");
    const creds = googleCredentials();
    if (!creds) throw new ConvexError(NOT_CONFIGURED);
    await requireSyncSlot(ctx, connection.userId, "youtube");

    const total: ImportResult = { created: 0, duplicates: 0, invalid: 0 };
    let error: string | undefined;
    try {
      let accessToken = connection.accessToken;
      if (connection.expiresAt < Date.now() + 60_000) {
        if (!connection.refreshToken) throw new GoogleApiError("YouTube access expired. Reconnect YouTube.", 401);
        const tokens = await refreshGoogleTokens(connection.refreshToken, creds);
        await ctx.runMutation(internal.imports.youtube.updateAccessToken, {
          connectionId: connection._id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
        });
        accessToken = tokens.accessToken;
      }
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_SYNC_PAGES && total.created < MAX_NEW_PER_SYNC; page++) {
        const { videos, nextPageToken } = await fetchLikedVideosPage(accessToken, MAX_NEW_PER_SYNC, pageToken);
        const posts = videos.slice(0, MAX_NEW_PER_SYNC - total.created);
        if (posts.length) {
          const result: ImportResult = await ctx.runMutation(internal.imports.posts.importForUser, { userId: connection.userId, posts });
          total.created += result.created;
          total.duplicates += result.duplicates;
          total.invalid += result.invalid;
          if (result.created === 0) break;
        }
        if (!nextPageToken) break;
        pageToken = nextPageToken;
      }
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 300) : "YouTube sync failed";
      console.error("YouTube sync failed", error);
    }
    await ctx.runMutation(internal.imports.youtube.recordSync, { connectionId: connection._id, ...total, error });
    if (error && total.created === 0) throw new ConvexError(error);
    return total;
  },
});
