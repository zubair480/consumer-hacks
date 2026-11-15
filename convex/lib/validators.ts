import { v, type VLiteral, type VUnion } from "convex/values";
import {
  ACTION_TYPES,
  ACTIVITY_EVENT_TYPES,
  COLLECTION_KINDS,
  CONTENT_TYPES,
  EXECUTION_STATUSES,
  EXTRACTION_STATUSES,
  REQUIREMENT_STATUSES,
  SOURCE_KINDS,
  SOURCE_PLATFORMS,
} from "../../src/shared/contracts";

// OWNER: Lead. Convex validators derived from src/shared/contracts.ts.

function literals<const T extends readonly [string, string, ...string[]]>(values: T) {
  const [a, b, ...rest] = values.map((value) => v.literal(value));
  return v.union(a, b, ...rest) as unknown as VUnion<T[number], VLiteral<T[number], "required">[], "required", never>;
}

export const vContentType = literals(CONTENT_TYPES);
export const vSourceKind = literals(SOURCE_KINDS);
export const vSourcePlatform = literals(SOURCE_PLATFORMS);
export const vExtractionStatus = literals(EXTRACTION_STATUSES);
export const vActionType = literals(ACTION_TYPES);
export const vExecutionStatus = literals(EXECUTION_STATUSES);
export const vActivityEventType = literals(ACTIVITY_EVENT_TYPES);
export const vCollectionKind = literals(COLLECTION_KINDS);
export const vRequirementStatus = literals(REQUIREMENT_STATUSES);

/** Optional key-fact fields shared by savedItems and contentAnalysis (contracts KeyFacts). */
export const keyFactFields = {
  sourceAccessible: v.optional(v.boolean()),
  missingInfo: v.optional(v.array(v.string())),
  deadline: v.optional(v.string()),
  location: v.optional(v.string()),
  price: v.optional(v.string()),
  organization: v.optional(v.string()),
};

/** userPreferences profile fields (contracts UserProfile). */
export const userProfileFields = {
  name: v.optional(v.string()),
  educationLevel: v.optional(v.string()),
  fieldOfStudy: v.optional(v.string()),
  country: v.optional(v.string()),
  citizenship: v.optional(v.string()),
  gpa: v.optional(v.number()),
  city: v.optional(v.string()),
  interests: v.optional(v.array(v.string())),
};

export const vOwnerId = v.string();

export const vFactEvidence = v.object({ quote: v.string(), source: v.string() });

export const vExtractedFact = v.object({
  key: v.string(),
  label: v.string(),
  value: v.string(),
  evidence: vFactEvidence,
  confidence: v.optional(v.number()),
});

export const vRequiredInput = v.object({
  key: v.string(),
  label: v.string(),
  kind: v.union(v.literal("text"), v.literal("number"), v.literal("date"), v.literal("location"), v.literal("choice")),
  required: v.boolean(),
  options: v.optional(v.array(v.string())),
});

const heading = v.optional(v.string());

export const vResultSection = v.union(
  v.object({ kind: v.literal("text"), heading, body: v.string() }),
  v.object({
    kind: v.literal("checklist"),
    heading,
    items: v.array(
      v.object({
        label: v.string(),
        detail: v.optional(v.string()),
        status: v.optional(vRequirementStatus),
        checked: v.optional(v.boolean()),
        done: v.optional(v.boolean()),
        evidence: v.optional(vFactEvidence),
      }),
    ),
  }),
  v.object({
    kind: v.literal("steps"),
    heading,
    steps: v.array(
      v.object({
        title: v.string(),
        detail: v.optional(v.string()),
        code: v.optional(v.string()),
        checked: v.optional(v.boolean()),
        evidence: v.optional(vFactEvidence),
      }),
    ),
  }),
  v.object({
    kind: v.literal("key_value"),
    heading,
    rows: v.array(
      v.object({
        label: v.string(),
        value: v.string(),
        detail: v.optional(v.string()),
        status: v.optional(vRequirementStatus),
        evidence: v.optional(vFactEvidence),
      }),
    ),
  }),
  v.object({ kind: v.literal("list"), heading, items: v.array(v.string()) }),
  v.object({ kind: v.literal("links"), heading, links: v.array(v.object({ label: v.string(), url: v.string() })) }),
  v.object({ kind: v.literal("code"), heading, language: v.optional(v.string()), code: v.string() }),
  v.object({
    kind: v.literal("palette"),
    heading,
    colors: v.array(v.object({ hex: v.string(), name: v.optional(v.string()) })),
  }),
);

export const vActionResultDocument = v.object({
  version: v.literal(1),
  actionType: vActionType,
  title: v.string(),
  summary: v.string(),
  sections: v.array(vResultSection),
  sources: v.array(v.object({ label: v.string(), url: v.optional(v.string()) })),
  shareText: v.string(),
  warnings: v.array(v.string()),
  markdown: v.optional(v.string()),
});
