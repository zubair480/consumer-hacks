import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import { CONTENT_TYPES, LIMITS, type ContentAnalysis, type ContentType, type ExtractedFact } from "../src/shared/contracts";
import { logEvent } from "./activity";
import { requireOwnedItem } from "./lib/auth";
import { callLLMJson, getLLMModel } from "./lib/llm";
import type { SourcePart } from "./lib/sources";
import { demoTypeFor } from "./lib/demo";
import { vContentType, vExtractedFact, vOwnerId } from "./lib/validators";

// OWNER: Thread B+C. Classification + fact extraction, and the
// contentAnalysis table.

const TYPE_GUIDE: Record<ContentType, string> = {
  restaurant: "a restaurant, cafe, bar, or food spot to visit",
  github_repository: "a GitHub (or other code host) repository or open-source project",
  code_snippet: "a piece of source code, a command, or a config snippet",
  scholarship: "a scholarship, grant, fellowship, or award for students",
  job: "a job posting, internship, or role",
  application: "anything with an application process: program, accelerator, residency, hackathon, admission",
  graphic: "a visual design: UI screenshot, poster, logo, illustration, layout, typography or color inspiration",
  recipe: "a recipe or cooking instructions",
  event: "an event with a date: meetup, concert, conference, webinar",
  travel: "a travel destination, hotel, itinerary, or trip idea",
  product: "a product to buy or a software product/app",
  research: "a paper, study, dataset, or in-depth technical article",
  tutorial: "a how-to guide, course, or step-by-step lesson",
  general_content: "anything else: news, opinion, a social post, a note",
};

const SYSTEM = `You are Zapy's content understanding engine. A user saved something from the internet; classify it and extract the facts they will need to act on it.

Content types (multi-label; include every type that clearly applies, most relevant first):
${CONTENT_TYPES.map((t) => `- ${t}: ${TYPE_GUIDE[t]}`).join("\n")}

Rules:
- primaryType is the single type that best describes what the user will want to do with this save.
- title: short, specific, human (max 80 chars), e.g. the scholarship name, repo name, restaurant name. No clickbait.
- summary: at most 2 plain sentences on what this is and why it matters. Only claims the source supports.
- facts: the concrete details a user needs to act. Typical keys: deadline, award_amount, eligibility, requirements, how_to_apply, organization, location, address, hours, price, cuisine, date, time, venue, stars, language, license, install_command, tech_stack, ingredients, servings, cook_time, colors, typography, layout, company, role, salary.
- NEVER invent or infer deadlines, dates, locations, addresses, prices, availability, eligibility, qualifications, or setup instructions. If the source does not state it, omit the fact.
- Every fact needs evidence: "quote" is a short verbatim excerpt copied exactly from the source text (max 200 chars) that states the fact; for an image, quote the visible text, or describe the image region when there is no text. "source" must be exactly one of the source ids listed in the input.
- deadline: "YYYY-MM-DD" only when the source states a specific date for it (and include a "deadline" fact quoting it), else null. location, price, organization: short strings only when the source states them (with a matching fact), else null.
- missingInfo: short phrases for details a user would need to act that the source does not provide (e.g. "Application deadline", "Address", "Setup instructions").
- If a source is marked as could-not-be-opened, classify from the URL and any other text, keep facts to what the inputs actually say, and say in missingInfo what is missing.
- confidence is 0..1. Prefer 6-15 high-value facts over many trivial ones; never list navigation menus, buttons, or boilerplate as facts.
- Images: a screenshot of a website, app UI, poster, logo, or any visual layout is "graphic" first (primaryType graphic) unless the user clearly saved it for something else in it (a recipe, an event's date, a scholarship's terms, a restaurant). For graphic, extract design facts: dominant colors as hex values (key "color_<n>"), typography (font style/weight/case), layout, visual style, and the brand or product shown; the quote describes the image region.`;

const SCHEMA_HINT = `{
  "contentTypes": ["scholarship", "application"],
  "primaryType": "scholarship",
  "title": "string",
  "summary": "string",
  "facts": [{ "key": "deadline", "label": "Deadline", "value": "March 1, 2027", "quote": "Applications are due March 1, 2027", "source": "<source id>", "confidence": 0.95 }],
  "missingInfo": ["string"],
  "deadline": "2027-03-01 or null",
  "location": "string or null",
  "price": "string or null",
  "organization": "string or null",
  "imageIsDesign": "true when an attached image is a screenshot of a website or app UI, a poster, flyer, logo, illustration, or layout; false otherwise or when there is no image"
}`;

type RawAnalysis = {
  contentTypes?: unknown;
  primaryType?: unknown;
  title?: unknown;
  summary?: unknown;
  facts?: { key?: unknown; label?: unknown; value?: unknown; quote?: unknown; source?: unknown; confidence?: unknown }[];
  missingInfo?: unknown;
  deadline?: unknown;
  location?: unknown;
  price?: unknown;
  organization?: unknown;
  imageIsDesign?: unknown;
};

/** The understood item: ContentAnalysis plus the top-level fields the UI and executors read directly. */
export type AnalysisResult = ContentAnalysis & {
  sourceAccessible: boolean;
  missingInfo: string[];
  deadline?: string;
  location?: string;
  price?: string;
  organization?: string;
};

const isType = (value: unknown): value is ContentType => CONTENT_TYPES.includes(value as ContentType);
const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const normalize = (text: string) => text.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^a-z0-9$%.:/'"]+/g, " ").trim();

/** Keeps a fact only if its quote really appears in the cited text source. Image facts can't be checked textually. */
function verifiedFacts(raw: RawAnalysis["facts"], parts: SourcePart[], hasImage: boolean): ExtractedFact[] {
  const corpus = parts.map((part) => ({ source: part.source, text: normalize(part.text) }));
  const facts: ExtractedFact[] = [];
  for (const fact of Array.isArray(raw) ? raw : []) {
    const key = str(fact.key).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    const value = str(fact.value);
    const quote = str(fact.quote).slice(0, 300);
    const cited = str(fact.source);
    if (!key || !value || !quote || /^(navigation|nav|menu|button|call_to_action|cta)(_|$)/.test(key)) continue;
    const needle = normalize(quote).slice(0, 120);
    const match = needle ? corpus.find((part) => part.text.includes(needle)) : undefined;
    let source: string;
    if (match) source = match.source;
    else if (hasImage && (cited === "image" || !corpus.some((part) => part.source === cited))) source = "image";
    else continue;
    const confidence = typeof fact.confidence === "number" ? Math.min(1, Math.max(0, fact.confidence)) : undefined;
    facts.push({ key, label: str(fact.label) || key.replace(/_/g, " "), value: value.slice(0, 500), evidence: { quote, source }, confidence });
  }
  return facts.slice(0, 25);
}

/** A top-level field is kept only when an evidence-checked fact backs it, so it can't be invented. */
function backed(value: unknown, facts: ExtractedFact[], keys: RegExp): string | undefined {
  const text = str(value);
  if (!text || text.toLowerCase() === "null") return undefined;
  return facts.some((fact) => keys.test(fact.key)) ? text.slice(0, 200) : undefined;
}

/** Classifies the material and extracts evidence-backed facts, retrying once on bad output. Call from an action. */
export async function analyzeContent(input: {
  parts: SourcePart[];
  images: string[];
  fallbackTitle?: string;
  sourceAccessible: boolean;
}): Promise<AnalysisResult> {
  const sources = [
    ...input.parts.map((part) => `### Source id: ${part.source} (${part.label})\n${part.text}`),
    ...(input.images.length ? ["### Source id: image\nThe attached image(s) the user saved."] : []),
  ].join("\n\n");
  let raw: RawAnalysis | undefined;
  let lastError = "";
  for (let attempt = 0; attempt < 2 && !raw; attempt++) {
    try {
      const candidate = await callLLMJson<RawAnalysis>({
        system: SYSTEM,
        user: `Analyze this save.\n\n${sources}`,
        images: input.images,
        schemaHint: SCHEMA_HINT,
        timeoutMs: 45000,
      });
      const hasTypes = isType(candidate.primaryType) || (Array.isArray(candidate.contentTypes) && candidate.contentTypes.some(isType));
      if (!hasTypes || !str(candidate.summary)) throw new Error("the model's answer was missing a content type or summary");
      raw = candidate;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  if (!raw) throw new Error(`Analysis failed twice: ${lastError}`);

  const listed = Array.isArray(raw.contentTypes) ? raw.contentTypes.filter(isType) : [];
  const modelPrimary = isType(raw.primaryType) ? raw.primaryType : (listed[0] ?? "general_content");
  const imageOnly = input.images.length > 0 && input.parts.length === 0;
  const designImage = imageOnly && (raw.imageIsDesign === true || raw.imageIsDesign === "true" || listed.includes("graphic"));
  const primaryType = designImage && (modelPrimary === "product" || modelPrimary === "general_content") ? "graphic" : modelPrimary;
  const facts = verifiedFacts(raw.facts, input.parts, input.images.length > 0);
  const deadline = backed(raw.deadline, facts, /deadline|due/);
  return {
    contentTypes: [...new Set([primaryType, ...listed])],
    primaryType,
    title: (str(raw.title) || input.fallbackTitle || "Untitled save").slice(0, LIMITS.titleMaxChars),
    summary: str(raw.summary).slice(0, 600),
    facts,
    model: getLLMModel(),
    sourceAccessible: input.sourceAccessible,
    missingInfo: (Array.isArray(raw.missingInfo) ? raw.missingInfo.map(str).filter(Boolean) : []).slice(0, 8),
    deadline: deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : undefined,
    location: backed(raw.location, facts, /location|address|venue|city|neighborhood/),
    price: backed(raw.price, facts, /price|cost|fee|tuition|salary/),
    organization: backed(raw.organization, facts, /organization|company|sponsor|provider|brand|owner|repository|employer|institution/),
  };
}

/** Replaces the item's analysis and marks the item ready with its understood fields. */
export const save = internalMutation({
  args: {
    itemId: v.id("savedItems"),
    extractionStatus: v.union(v.literal("ready"), v.literal("needs_input")),
    extractionError: v.optional(v.string()),
    sourceAccessible: v.boolean(),
    missingInfo: v.array(v.string()),
    deadline: v.optional(v.string()),
    location: v.optional(v.string()),
    price: v.optional(v.string()),
    organization: v.optional(v.string()),
    contentTypes: v.array(vContentType),
    primaryType: vContentType,
    title: v.string(),
    summary: v.string(),
    facts: v.array(vExtractedFact),
    model: v.optional(v.string()),
  },
  handler: async (ctx, { itemId, extractionStatus, extractionError, ...analysis }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item) return null;
    const demoType = demoTypeFor(item.demoKey);
    if (demoType) {
      analysis.primaryType = demoType;
      analysis.contentTypes = [demoType, ...analysis.contentTypes.filter((t) => t !== demoType)];
      extractionStatus = "ready";
      extractionError = undefined;
    }
    const previous = await ctx.db.query("contentAnalysis").withIndex("by_itemId", (q) => q.eq("itemId", itemId)).take(20);
    const renamedByUser = Boolean(item.title) && previous.length > 0 && previous.every((row) => row.title !== item.title);
    for (const row of previous) await ctx.db.delete("contentAnalysis", row._id);
    await ctx.db.insert("contentAnalysis", { userId: item.userId, itemId, ...analysis, createdAt: Date.now() });
    await ctx.runMutation(internal.items.setExtraction, {
      itemId,
      extractionStatus,
      extractionError,
      title: renamedByUser ? item.title : analysis.title,
      summary: analysis.summary,
      contentTypes: analysis.contentTypes,
      primaryType: analysis.primaryType,
    });
    await ctx.db.patch("savedItems", itemId, {
      sourceAccessible: analysis.sourceAccessible,
      missingInfo: analysis.missingInfo,
      deadline: analysis.deadline,
      location: analysis.location,
      price: analysis.price,
      organization: analysis.organization,
    });
    await logEvent(ctx, item.userId, {
      type: extractionStatus === "ready" ? "analysis_completed" : "analysis_needs_input",
      title: extractionStatus === "ready" ? "Understood" : "Needs your input",
      detail: analysis.title,
      itemId,
    });
    return null;
  },
});

/** Marks the item extracting and logs that analysis started. */
export const markStarted = internalMutation({
  args: { itemId: v.id("savedItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item) return null;
    await ctx.runMutation(internal.items.setExtraction, { itemId, extractionStatus: "extracting" });
    await logEvent(ctx, item.userId, { type: "analysis_started", title: "Understanding…", itemId });
    return null;
  },
});

/** Records an ingestion failure or a request for more input, with an activity event. */
export const markProblem = internalMutation({
  args: {
    itemId: v.id("savedItems"),
    extractionStatus: v.union(v.literal("failed"), v.literal("needs_input")),
    extractionError: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, { itemId, extractionStatus, extractionError, title }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item) return null;
    await ctx.runMutation(internal.items.setExtraction, {
      itemId,
      extractionStatus,
      extractionError,
      ...(title && !item.title ? { title } : {}),
    });
    await logEvent(ctx, item.userId, {
      type: extractionStatus === "needs_input" ? "analysis_needs_input" : "analysis_failed",
      title: extractionStatus === "needs_input" ? "Needs your input" : "Analysis failed",
      detail: extractionError,
      itemId,
    });
    return null;
  },
});

/** The item's latest analysis (types, summary, evidence-backed facts), or null before it is ready. */
export const getForItem = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    await requireOwnedItem(ctx, ownerId, itemId);
    return await ctx.db
      .query("contentAnalysis")
      .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
      .order("desc")
      .first();
  },
});
