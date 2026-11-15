import { defineTable } from "convex/server";
import { v } from "convex/values";

// OWNER: Agent mode 2 (ZUB-36). Approval-gated agent jobs, spread into convex/schema.ts.

export const vAgentJobStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("needs_approval"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const vCalendarProposal = v.object({
  summary: v.string(),
  description: v.string(),
  location: v.string(),
  /** YYYY-MM-DDTHH:MM:SS, or "" when the source gave no date and the user must fill it in. */
  startDateTime: v.string(),
  timezone: v.string(),
  durationMinutes: v.number(),
});

export const agentTables = {
  agentJobs: defineTable({
    userId: v.id("users"),
    itemId: v.id("savedItems"),
    kind: v.literal("calendar"),
    status: vAgentJobStatus,
    proposal: vCalendarProposal,
    resultUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_itemId", ["userId", "itemId"])
    .index("by_userId", ["userId"]),
};
