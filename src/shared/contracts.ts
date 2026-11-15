/**
 * Zapy shared contracts.
 *
 * OWNER: Lead thread (Thread 1). This file is the single source of truth for
 * the shapes the app (src/**) and the backend (convex/**) agree on. Convex
 * validators in convex/lib/validators.ts are generated from these constants,
 * so a value added here becomes valid in the schema automatically.
 *
 * Rules for parallel threads (A, B+C, D+E, F):
 * - Import from here; never redeclare these unions locally.
 * - Need a change? Ask the Captain. Changes are additive only (new union
 *   members, new optional fields) so no other thread breaks.
 * - Keep this file free of React Native and Convex imports: it is bundled
 *   by both Metro and the Convex bundler.
 */

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/**
 * Device-local identity. A UUID v4 from expo-crypto's randomUUID, stored in
 * expo-secure-store under OWNER_ID_STORAGE_KEY. Every public Convex function
 * takes it as `ownerId`; the users table is keyed by it.
 */
export type OwnerId = string;
export const OWNER_ID_STORAGE_KEY = "afterscroll.ownerId";

/** Every public Convex function's args extend this. */
export type OwnerArgs = { ownerId: OwnerId };

/* ------------------------------------------------------------------ */
/* Content understanding                                               */
/* ------------------------------------------------------------------ */

/** The 14 Phase 1 content types. Classification is multi-label. */
export const CONTENT_TYPES = [
  "restaurant",
  "github_repository",
  "code_snippet",
  "scholarship",
  "job",
  "application",
  "graphic",
  "recipe",
  "event",
  "travel",
  "product",
  "research",
  "tutorial",
  "general_content",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** Human labels for chips, filters, and headings. */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  restaurant: "Restaurant",
  github_repository: "GitHub repo",
  code_snippet: "Code snippet",
  scholarship: "Scholarship",
  job: "Job",
  application: "Application",
  graphic: "Design",
  recipe: "Recipe",
  event: "Event",
  travel: "Travel",
  product: "Product",
  research: "Research",
  tutorial: "Tutorial",
  general_content: "General",
};

/** How the user gave us the content. */
export const SOURCE_KINDS = ["url", "text", "image"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** Where a URL came from. Derived from the hostname by detectSourcePlatform. */
export const SOURCE_PLATFORMS = [
  "web",
  "github",
  "instagram",
  "tiktok",
  "x",
  "linkedin",
  "youtube",
  "reddit",
  "threads",
  "pinterest",
  "google_maps",
  "yelp",
  "manual",
] as const;
export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number];

const PLATFORM_HOSTS: [string, SourcePlatform][] = [
  ["github.com", "github"],
  ["instagram.com", "instagram"],
  ["tiktok.com", "tiktok"],
  ["x.com", "x"],
  ["twitter.com", "x"],
  ["linkedin.com", "linkedin"],
  ["youtube.com", "youtube"],
  ["youtu.be", "youtube"],
  ["reddit.com", "reddit"],
  ["threads.net", "threads"],
  ["threads.com", "threads"],
  ["pinterest.com", "pinterest"],
  ["maps.google.com", "google_maps"],
  ["maps.app.goo.gl", "google_maps"],
  ["yelp.com", "yelp"],
];

/** Maps a URL to its platform; anything unrecognised is "web". */
export function detectSourcePlatform(url: string): SourcePlatform {
  const host = url
    .replace(/^[a-z]+:\/\//i, "")
    .split(/[/?#]/)[0]
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^m\./, "");
  const match = PLATFORM_HOSTS.find(([h]) => host === h || host.endsWith("." + h));
  return match ? match[1] : "web";
}

/**
 * Lifecycle of a saved item's ingestion + understanding (owned by B+C).
 *
 * pending    -> saved, waiting for ingestion to start
 * extracting -> fetching the URL / README / reading the image
 * analyzing  -> LLM classification + fact extraction
 * ready      -> contentAnalysis + actionSuggestions written
 * needs_input-> source inaccessible; keep the link and ask the user for a
 *               screenshot or pasted text (see extractionError for why)
 * failed     -> unexpected error; the user can retry (items.retry)
 */
export const EXTRACTION_STATUSES = [
  "pending",
  "extracting",
  "analyzing",
  "ready",
  "needs_input",
  "failed",
] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

/** Statuses that mean ingestion is still running (show a spinner). */
export const IN_PROGRESS_EXTRACTION_STATUSES: readonly ExtractionStatus[] = [
  "pending",
  "extracting",
  "analyzing",
];

/** Where an extracted fact came from. Every fact must carry evidence. */
export type FactEvidence = {
  /** Verbatim quote from the source, or a description of the image region. */
  quote: string;
  /** URL, "user_text", or "image". */
  source: string;
};

/**
 * One extracted fact. Never fabricate: if the source does not state a
 * deadline, location, price, requirement, etc., omit the fact entirely.
 */
export type ExtractedFact = {
  /** Stable machine key, e.g. "deadline", "address", "stars", "language". */
  key: string;
  /** Display label, e.g. "Deadline". */
  label: string;
  value: string;
  evidence: FactEvidence;
  /** 0..1 model confidence. */
  confidence?: number;
};

/**
 * Key facts promoted to top-level fields on contentAnalysis and savedItems so
 * the UI can show them without parsing facts[]. All optional; set only when the
 * source states them (never inferred). deadline is an ISO date "YYYY-MM-DD".
 */
export type KeyFacts = {
  /** false when the source could not be fetched/read (login wall, 404, blocked). */
  sourceAccessible?: boolean;
  /** Things the user should supply because the source didn't say (e.g. "deadline", "eligibility"). */
  missingInfo?: string[];
  deadline?: string;
  location?: string;
  price?: string;
  organization?: string;
};

/** Shape of a contentAnalysis row's payload (written by B+C). */
export type ContentAnalysis = KeyFacts & {
  contentTypes: ContentType[];
  primaryType: ContentType;
  title: string;
  summary: string;
  facts: ExtractedFact[];
  /** Model id used, e.g. the OPENAI_MODEL value. */
  model?: string;
};

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** Every contextual action type. Routing lives in ACTION_ROUTING. */
export const ACTION_TYPES = [
  // Restaurant
  "plan_visit",
  "find_location",
  "prepare_invitation",
  // GitHub repository
  "understand_project",
  "extract_setup_guide",
  "prepare_integration_plan",
  // Scholarship
  "check_eligibility",
  "prepare_application",
  "track_deadline",
  // Graphic
  "extract_style",
  "create_design_brief",
  "add_to_moodboard",
  // Recipe
  "create_shopping_list",
  "show_cooking_steps",
  "plan_meal",
  // Code snippet
  "explain_code",
  "suggest_test_cases",
  "prepare_reusable_example",
  // Fallback for types without a dedicated route
  "summarize",
  "extract_key_points",
  "add_to_collection",
  // Agent mode (dispatched outside ACTION_ROUTING, see AGENT_ACTIONS)
  "run_repo",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Display metadata per action type (D+E may refine copy, not keys). */
export const ACTION_LABELS: Record<ActionType, { title: string; description: string }> = {
  plan_visit: { title: "Plan a visit", description: "Hours, best time to go, and what to order." },
  find_location: { title: "Find location", description: "Address and directions from the source." },
  prepare_invitation: { title: "Prepare invitation", description: "A ready-to-send message to invite friends." },
  understand_project: { title: "Understand project", description: "What this repository does and how it is built." },
  extract_setup_guide: { title: "Extract setup guide", description: "Step-by-step setup from the README." },
  prepare_integration_plan: { title: "Prepare integration plan", description: "How to use this in your own project." },
  check_eligibility: { title: "Check eligibility", description: "Requirements checked against your profile." },
  prepare_application: { title: "Prepare application", description: "A checklist of everything the application needs." },
  track_deadline: { title: "Track verified deadline", description: "Track the deadline stated by the source." },
  extract_style: { title: "Extract style", description: "Palette, typography, and layout of the design." },
  create_design_brief: { title: "Create design brief", description: "A brief you can hand to a designer." },
  add_to_moodboard: { title: "Add to moodboard", description: "Save this design to a moodboard collection." },
  create_shopping_list: { title: "Create shopping list", description: "Ingredients grouped for the store." },
  show_cooking_steps: { title: "Show cooking steps", description: "Clean, numbered cooking steps." },
  plan_meal: { title: "Plan meal", description: "Fit this recipe into your week." },
  explain_code: { title: "Explain", description: "What this code does, line by line." },
  suggest_test_cases: { title: "Suggest test cases", description: "Edge cases and tests worth writing." },
  prepare_reusable_example: { title: "Prepare reusable example", description: "A cleaned-up snippet you can reuse." },
  summarize: { title: "Summarize", description: "The key ideas in a few lines." },
  extract_key_points: { title: "Extract key points", description: "Facts and takeaways with sources." },
  add_to_collection: { title: "Add to collection", description: "File this save into a collection." },
  run_repo: { title: "Run it for me", description: "Clone the repo in a sandbox, install it, and run its tests or example." },
};

/**
 * Agent-mode actions: a 4th suggestion shown after the routed three, started
 * through their own mutation rather than actions.execute.
 */
export const AGENT_ACTIONS: Partial<Record<ActionType, { contentTypes: readonly ContentType[] }>> = {
  run_repo: { contentTypes: ["github_repository"] },
};

/**
 * The three contextual actions per content type, in display order.
 * Types without a dedicated route fall back to FALLBACK_ACTIONS.
 * D+E's convex/lib/actionCatalog.ts builds suggestions from this.
 */
export const ACTION_ROUTING: Partial<Record<ContentType, readonly [ActionType, ActionType, ActionType]>> = {
  restaurant: ["plan_visit", "find_location", "prepare_invitation"],
  github_repository: ["understand_project", "extract_setup_guide", "prepare_integration_plan"],
  scholarship: ["check_eligibility", "prepare_application", "track_deadline"],
  application: ["check_eligibility", "prepare_application", "track_deadline"],
  graphic: ["extract_style", "create_design_brief", "add_to_moodboard"],
  recipe: ["create_shopping_list", "show_cooking_steps", "plan_meal"],
  code_snippet: ["explain_code", "suggest_test_cases", "prepare_reusable_example"],
};
export const FALLBACK_ACTIONS: readonly [ActionType, ActionType, ActionType] = [
  "summarize",
  "extract_key_points",
  "add_to_collection",
];

/** Returns the three actions for a primary type. */
export function actionsForType(type: ContentType): readonly [ActionType, ActionType, ActionType] {
  return ACTION_ROUTING[type] ?? FALLBACK_ACTIONS;
}

/** An input an action needs before it can run (e.g. "your GPA"). */
export type RequiredInput = {
  key: string;
  label: string;
  kind: "text" | "number" | "date" | "location" | "choice";
  required: boolean;
  /** Options when kind is "choice". */
  options?: string[];
  /** Where the UI pre-fills the value from, e.g. "profile.gpa", "profile.city", "item.deadline". */
  prefillFrom?: string;
};

/** Shape of an actionSuggestions row (written by D+E). */
export type ActionSuggestion = {
  itemId: string;
  actionType: ActionType;
  title: string;
  description: string;
  requiredInputs: RequiredInput[];
  /** false when an executor is not implemented yet; UI shows "coming soon". */
  canExecute: boolean;
  /** true when the action reaches outside Zapy (share, send, publish). */
  requiresApproval: boolean;
  /** 0-based display order. */
  rank: number;
};

/**
 * actionExecutions lifecycle (D+E).
 * awaiting_approval: result is ready but an external step needs the user.
 * Never mark an external action succeeded without provider confirmation.
 */
export const EXECUTION_STATUSES = [
  "queued",
  "running",
  "awaiting_approval",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* Action result document                                              */
/* ------------------------------------------------------------------ */

/** Eligibility-style verdict for a requirement against the user's profile. */
export const REQUIREMENT_STATUSES = ["met", "unmet", "unknown"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

/**
 * One checklist row. `checked` is the user's toggle state, persisted with
 * actionResults.setChecklistItem. `done` is kept for compatibility; readers
 * should use `checked ?? done ?? false`.
 */
export type ChecklistItem = {
  label: string;
  detail?: string;
  status?: RequirementStatus;
  checked?: boolean;
  done?: boolean;
  evidence?: FactEvidence;
};

/**
 * A result is a list of typed sections so every executor renders through
 * one generic Action Results screen (A) and copies/shares as plain text.
 */
export type ResultSection =
  | { kind: "text"; heading?: string; body: string }
  | { kind: "checklist"; heading?: string; items: ChecklistItem[] }
  | { kind: "steps"; heading?: string; steps: { title: string; detail?: string; code?: string; checked?: boolean; evidence?: FactEvidence }[] }
  | { kind: "key_value"; heading?: string; rows: { label: string; value: string; detail?: string; status?: RequirementStatus; evidence?: FactEvidence }[] }
  | { kind: "list"; heading?: string; items: string[] }
  | { kind: "links"; heading?: string; links: { label: string; url: string }[] }
  | { kind: "code"; heading?: string; language?: string; code: string }
  | { kind: "palette"; heading?: string; colors: { hex: string; name?: string }[] };

export const RESULT_SECTION_KINDS = ["text", "checklist", "steps", "key_value", "list", "links", "code", "palette"] as const;
export type ResultSectionKind = (typeof RESULT_SECTION_KINDS)[number];

/**
 * The persisted payload of an actionResults row. Executors (D+E) must
 * return exactly this. Real data only: no mock output presented as done.
 */
export type ActionResultDocument = {
  /** Bump only with a migration. */
  version: 1;
  actionType: ActionType;
  title: string;
  /** One or two sentence overview shown at the top. */
  summary: string;
  sections: ResultSection[];
  /** Sources the executor actually used. */
  sources: { label: string; url?: string }[];
  /** Plain-text rendition for Copy and the native share sheet. */
  shareText: string;
  /** Things the user must know: missing data, unverified claims. */
  warnings: string[];
  /** Optional Markdown rendition for Copy/Share; fall back to shareText. */
  markdown?: string;
};

/* ------------------------------------------------------------------ */
/* Activity, collections, preferences (F)                              */
/* ------------------------------------------------------------------ */

export const ACTIVITY_EVENT_TYPES = [
  "item_saved",
  "item_updated",
  "item_deleted",
  "analysis_started",
  "analysis_completed",
  "analysis_needs_input",
  "analysis_failed",
  "action_started",
  "action_completed",
  "action_failed",
  "collection_updated",
] as const;
export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

/** userPreferences profile used by eligibility checks and planning. All optional. */
export type UserProfile = {
  name?: string;
  educationLevel?: string;
  fieldOfStudy?: string;
  country?: string;
  citizenship?: string;
  gpa?: number;
  city?: string;
  interests?: string[];
};

export const COLLECTION_KINDS = ["custom", "moodboard", "reading_list"] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

/* ------------------------------------------------------------------ */
/* Client-facing item shape                                            */
/* ------------------------------------------------------------------ */

/** What items.list / items.get return (savedItems row + resolved image URL). */
export type SavedItemView = {
  _id: string;
  _creationTime: number;
  sourceKind: SourceKind;
  sourceUrl?: string;
  sourcePlatform: SourcePlatform;
  rawText?: string;
  imageStorageId?: string;
  imageUrl: string | null;
  title?: string;
  summary?: string;
  contentTypes: ContentType[];
  primaryType?: ContentType;
  sourceAccessible?: boolean;
  missingInfo?: string[];
  deadline?: string;
  location?: string;
  price?: string;
  organization?: string;
  extractionStatus: ExtractionStatus;
  extractionError?: string;
  createdAt: number;
  updatedAt: number;
};

/** Limits enforced by items.create / items.update. */
export const LIMITS = {
  rawTextMaxChars: 20000,
  urlMaxChars: 2048,
  titleMaxChars: 200,
  listDefault: 50,
  listMax: 200,
} as const;
