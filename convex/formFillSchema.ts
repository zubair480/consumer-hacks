import { defineTable } from "convex/server";
import { v } from "convex/values";

// Browserbase "Fill it for me" (agent mode 3). Spread into convex/schema.ts.

export const vFormFillStatus = v.union(
  v.literal("queued"),
  v.literal("filling"),
  v.literal("needs_approval"),
  v.literal("approved"),
  v.literal("cancelled"),
  v.literal("expired"),
  v.literal("failed"),
  v.literal("blocked"),
);

export const vFormFillField = v.object({
  label: v.string(),
  kind: v.string(),
  value: v.optional(v.string()),
  state: v.union(v.literal("filled"), v.literal("skipped"), v.literal("failed")),
  note: v.optional(v.string()),
});

export const formFillTables = {
  formFillRuns: defineTable({
    userId: v.id("users"),
    itemId: v.id("savedItems"),
    url: v.string(),
    status: vFormFillStatus,
    fields: v.array(vFormFillField),
    screenshotIds: v.array(v.id("_storage")),
    liveViewUrl: v.optional(v.string()),
    message: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_itemId", ["userId", "itemId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),
};
