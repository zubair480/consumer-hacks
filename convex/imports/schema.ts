import { defineTable } from "convex/server";
import { v } from "convex/values";

// OWNER: Import thread (CONS-19). One-tap Import tables, spread into convex/schema.ts.
// OAuth tokens live only in importConnections and are read only by internal functions;
// no public query returns them.

export const vImportPlatform = v.union(v.literal("x"), v.literal("instagram"), v.literal("linkedin"), v.literal("github"), v.literal("youtube"));

export const importTables = {
  /** One connected account per user and platform. */
  importConnections: defineTable({
    userId: v.id("users"),
    platform: vImportPlatform,
    externalUserId: v.string(),
    username: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    /** ms epoch when accessToken expires. */
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    lastSyncNew: v.optional(v.number()),
    lastSyncSkipped: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_and_platform", ["userId", "platform"]),

  /** Pending OAuth handshakes (PKCE verifier + where to send the app back). Deleted on callback. */
  importOAuthStates: defineTable({
    state: v.string(),
    userId: v.id("users"),
    platform: vImportPlatform,
    codeVerifier: v.string(),
    returnUrl: v.string(),
    createdAt: v.number(),
  }).index("by_state", ["state"]),

  /** Every imported post, keyed by the platform's own id, so re-syncs skip what is already in Zapy. */
  importedPosts: defineTable({
    userId: v.id("users"),
    platform: vImportPlatform,
    externalId: v.string(),
    itemId: v.id("savedItems"),
    savedAt: v.optional(v.number()),
    importedAt: v.number(),
  }).index("by_userId_and_platform_and_externalId", ["userId", "platform", "externalId"]),

  /** GitHub stars import (ZUB-19): the username to sync and the last result. No tokens. */
  githubImportAccounts: defineTable({
    userId: v.id("users"),
    username: v.string(),
    lastSyncedAt: v.optional(v.number()),
    lastSyncNew: v.optional(v.number()),
    lastSyncSkipped: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
};
