import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vActionResultDocument,
  vActionType,
  vActivityEventType,
  vCollectionKind,
  vContentType,
  vExecutionStatus,
  vExtractedFact,
  vExtractionStatus,
  vRequiredInput,
  vSourceKind,
  vSourcePlatform,
  keyFactFields,
  userProfileFields,
} from "./lib/validators";
import { importTables } from "./imports/schema";
import { socialTables } from "./social/schema";
import { shareTables } from "./shareSchema";
import { formFillTables } from "./formFillSchema";
import { agentTables } from "./agents/schema";

// OWNER: Lead. Other threads add only new OPTIONAL fields or new indexes,
// coordinated through the Captain. Every row except users carries userId,
// and every public function checks it via convex/lib/auth.ts.
export default defineSchema({
  users: defineTable({
    ownerId: v.string(),
    displayName: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    /** Bearer token for POST /save (Share to Zapy). */
    shareToken: v.optional(v.string()),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_shareToken", ["shareToken"]),

  savedItems: defineTable({
    userId: v.id("users"),
    sourceKind: vSourceKind,
    sourceUrl: v.optional(v.string()),
    sourcePlatform: vSourcePlatform,
    rawText: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    contentTypes: v.array(vContentType),
    primaryType: v.optional(vContentType),
    ...keyFactFields,
    extractionStatus: vExtractionStatus,
    extractionError: v.optional(v.string()),
    /** Lowercased title + summary + text + url for Library search; maintained by items.ts / ingest. */
    searchText: v.string(),
    collectionIds: v.optional(v.array(v.id("collections"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_userId_and_primaryType_and_createdAt", ["userId", "primaryType", "createdAt"])
    .index("by_userId_and_extractionStatus", ["userId", "extractionStatus"])
    .index("by_userId_and_sourceUrl", ["userId", "sourceUrl"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["userId", "primaryType"] }),

  contentAnalysis: defineTable({
    userId: v.id("users"),
    itemId: v.id("savedItems"),
    contentTypes: v.array(vContentType),
    primaryType: vContentType,
    title: v.string(),
    summary: v.string(),
    facts: v.array(vExtractedFact),
    model: v.optional(v.string()),
    ...keyFactFields,
    createdAt: v.number(),
  })
    .index("by_itemId", ["itemId"])
    .index("by_userId", ["userId"]),

  actionSuggestions: defineTable({
    userId: v.id("users"),
    itemId: v.id("savedItems"),
    actionType: vActionType,
    title: v.string(),
    description: v.string(),
    requiredInputs: v.array(vRequiredInput),
    canExecute: v.boolean(),
    requiresApproval: v.boolean(),
    rank: v.number(),
    createdAt: v.number(),
  })
    .index("by_itemId_and_rank", ["itemId", "rank"])
    .index("by_userId", ["userId"]),

  actionExecutions: defineTable({
    userId: v.id("users"),
    itemId: v.id("savedItems"),
    suggestionId: v.optional(v.id("actionSuggestions")),
    actionType: vActionType,
    status: vExecutionStatus,
    inputs: v.optional(v.record(v.string(), v.string())),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_itemId_and_createdAt", ["itemId", "createdAt"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_userId_and_status", ["userId", "status"]),

  actionResults: defineTable({
    userId: v.id("users"),
    itemId: v.id("savedItems"),
    executionId: v.id("actionExecutions"),
    actionType: vActionType,
    result: vActionResultDocument,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_executionId", ["executionId"])
    .index("by_itemId", ["itemId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),

  collections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    kind: vCollectionKind,
    description: v.optional(v.string()),
    coverItemId: v.optional(v.id("savedItems")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_and_createdAt", ["userId", "createdAt"]),

  activityEvents: defineTable({
    userId: v.id("users"),
    type: vActivityEventType,
    title: v.string(),
    detail: v.optional(v.string()),
    itemId: v.optional(v.id("savedItems")),
    executionId: v.optional(v.id("actionExecutions")),
    collectionId: v.optional(v.id("collections")),
    createdAt: v.number(),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_itemId", ["itemId"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    ...userProfileFields,
    homeCity: v.optional(v.string()),
    /** Free-form profile facts used by eligibility checks (e.g. GPA, major, citizenship). */
    profileFacts: v.optional(v.record(v.string(), v.string())),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // Phase 2 (Social Studio), owned by Thread H+I.
  ...socialTables,

  // One-tap Import (CONS-19).
  ...importTables,

  // Share to Zapy (CONS-22).
  ...shareTables,

  // Browserbase "Fill it for me".
  ...formFillTables,
  // Agent mode 2 (ZUB-36).
  ...agentTables,
});
