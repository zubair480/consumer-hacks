import { defineTable } from "convex/server";
import { v } from "convex/values";

// OWNER: Share to Zapy (CONS-22). Spread into convex/schema.ts.

export const shareTables = {
  /** Fixed one-minute window of POST /save requests per user, for the 30/min limit. */
  shareRateLimits: defineTable({
    userId: v.id("users"),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_userId", ["userId"]),
};
