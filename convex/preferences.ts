import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { LIMITS, type UserProfile } from "../src/shared/contracts";
import { ensureUser, getUser } from "./lib/auth";
import { vOwnerId } from "./lib/validators";

// OWNER: F. Profile (userPreferences) and Profile stats.

const TEXT_MAX = 120;
const TEXT_FIELDS = ["name", "educationLevel", "fieldOfStudy", "country", "citizenship", "city", "email", "phone"] as const;

function toProfile(row: Doc<"userPreferences"> | null): UserProfile & { updatedAt?: number } {
  if (!row) return {};
  return {
    name: row.name,
    educationLevel: row.educationLevel,
    fieldOfStudy: row.fieldOfStudy,
    country: row.country,
    citizenship: row.citizenship,
    gpa: row.gpa,
    city: row.city ?? row.homeCity,
    interests: row.interests,
    email: row.email,
    phone: row.phone,
    updatedAt: row.updatedAt,
  };
}

async function preferencesRow(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("userPreferences")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

/** The owner's Profile (UserProfile + updatedAt); {} for a new device. */
export const get = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await getUser(ctx, ownerId);
    return toProfile(user ? await preferencesRow(ctx, user._id) : null);
  },
});

/** For executors (eligibility, visit planning). Null when the user has no Profile yet. */
export const getForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const row = await preferencesRow(ctx, userId);
    return row ? toProfile(row) : null;
  },
});

const vText = v.optional(v.union(v.string(), v.null()));

/** Partial update: omitted fields stay; null (or "" for text) clears a field. Returns the Profile. */
export const upsert = mutation({
  args: {
    ownerId: vOwnerId,
    name: vText,
    educationLevel: vText,
    fieldOfStudy: vText,
    country: vText,
    citizenship: vText,
    city: vText,
    email: vText,
    phone: vText,
    gpa: v.optional(v.union(v.number(), v.null())),
    interests: v.optional(v.union(v.array(v.string()), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await ensureUser(ctx, args.ownerId);
    const patch: Partial<Doc<"userPreferences">> = { updatedAt: Date.now() };
    for (const key of TEXT_FIELDS) {
      const value = args[key];
      if (value !== undefined) patch[key] = value?.trim().slice(0, TEXT_MAX) || undefined;
    }
    if (args.gpa !== undefined) {
      if (args.gpa !== null && !(args.gpa >= 0 && args.gpa <= 10)) throw new ConvexError("GPA must be between 0 and 10");
      patch.gpa = args.gpa ?? undefined;
    }
    if (args.interests !== undefined) {
      const cleaned = [...new Set((args.interests ?? []).map((i) => i.trim().slice(0, 40)).filter(Boolean))].slice(0, 30);
      patch.interests = cleaned.length ? cleaned : undefined;
    }
    if (patch.city !== undefined || args.city !== undefined) patch.homeCity = undefined;
    const existing = await preferencesRow(ctx, user._id);
    if (existing) await ctx.db.patch("userPreferences", existing._id, patch);
    else await ctx.db.insert("userPreferences", { ...patch, userId: user._id, updatedAt: Date.now() });
    if (args.name !== undefined) await ctx.db.patch("users", user._id, { displayName: patch.name });
    return toProfile(await preferencesRow(ctx, user._id));
  },
});

/** Profile stats. Counts stop at 200; `capped` says the real number may be higher. */
export const stats = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return { saves: 0, outcomes: 0, capped: false };
    const [saves, outcomes] = await Promise.all([
      ctx.db
        .query("savedItems")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
        .take(LIMITS.listMax),
      ctx.db
        .query("actionResults")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
        .take(LIMITS.listMax),
    ]);
    return {
      saves: saves.length,
      outcomes: outcomes.length,
      capped: saves.length === LIMITS.listMax || outcomes.length === LIMITS.listMax,
    };
  },
});
