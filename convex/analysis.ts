import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, query } from "./_generated/server";
import { CONTENT_TYPES, LIMITS, type ContentAnalysis, type ContentType, type ExtractedFact } from "../src/shared/contracts";
import { requireOwnedItem } from "./lib/auth";
import { callLLMJson, getLLMModel } from "./lib/llm";
import type { SourcePart } from "./lib/sources";
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

const SYSTEM = `You are AfterScroll's content understanding engine. A user saved something from the internet; classify it and extract the facts they will need to act on it.

Content types (multi-label; include every type that clearly applies, most relevant first):
${CONTENT_TYPES.map((t) => `- ${t}: ${TYPE_GUIDE[t]}`).join("\n")}

Rules:
- primaryType is the single type that best describes what the user will want to do with this save.
- title: short, specific, human (max 80 chars), e.g. the scholarship name, repo name, restaurant name. No clickbait.
- summary: 1-3 plain sentences on what this is and why it matters. Only claims the source supports.
- facts: the concrete details a user needs to act. Typical keys: deadline, award_amount, eligibility, requirements, how_to_apply, organization, location, address, hours, price, cuisine, date, time, venue, stars, language, license, install_command, tech_stack, ingredients, servings, cook_time, colors, typography, layout, company, role, salary.
- NEVER invent or infer deadlines, dates, locations, addresses, prices, availability, eligibility, qualifications, or setup instructions. If the source does not state it, omit the fact.
- Every fact needs evidence: "quote" is a short verbatim excerpt copied exactly from the source text (max 200 chars) that states the fact; for an image, quote the visible text, or describe the image region when there is no text. "source" must be exactly one of the source ids listed in the input.
- confidence is 0..1. Prefer 6-15 high-value facts over many trivial ones; never list navigation menus, buttons, or boilerplate as facts.
- Images: a screenshot of a website, app UI, poster, logo, or any visual layout is "graphic" first (primaryType graphic) unless the user clearly saved it for something else in it (a recipe, an event's date, a scholarship's terms, a restaurant). For graphic, extract design facts: dominant colors as hex values (key "color_<n>"), typography (font style/weight/case), layout, visual style, and the brand or product shown; the quote describes the image region.`;

const SCHEMA_HINT = `{
  "contentTypes": ["scholarship", "application"],
  "primaryType": "scholarship",
  "title": "string",
  "summary": "string",
  "facts": [{ "key": "deadline", "label": "Deadline", "value": "March 1, 2027", "quote": "Applications are due March 1, 2027", "source": "<source id>", "confidence": 0.95 }]
}`;

type RawAnalysis = {
  contentTypes?: unknown;
  primaryType?: unknown;
  title?: unknown;
  summary?: unknown;
  facts?: { key?: unknown; label?: unknown; value?: unknown; quote?: unknown; source?: unknown; confidence?: unknown }[];
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
    if (!key || !value || !quote) continue;
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

/** Classifies the material and extracts evidence-backed facts. Call from an action. */
export async function analyzeContent(input: { parts: SourcePart[]; images: string[]; fallbackTitle?: string }): Promise<ContentAnalysis> {
  const sources = [
    ...input.parts.map((part) => `### Source id: ${part.source} (${part.label})\n${part.text}`),
    ...(input.images.length ? ["### Source id: image\nThe attached image(s) the user saved."] : []),
  ].join("\n\n");
  const raw = await callLLMJson<RawAnalysis>({
    system: SYSTEM,
    user: `Analyze this save.\n\n${sources}`,
    images: input.images,
    schemaHint: SCHEMA_HINT,
  });
  const listed = Array.isArray(raw.contentTypes) ? raw.contentTypes.filter(isType) : [];
  const primaryType = isType(raw.primaryType) ? raw.primaryType : (listed[0] ?? "general_content");
  const contentTypes = [primaryType, ...listed.filter((t) => t !== primaryType)];
  return {
    contentTypes: [...new Set(contentTypes)],
    primaryType,
    title: (str(raw.title) || input.fallbackTitle || "Untitled save").slice(0, LIMITS.titleMaxChars),
    summary: str(raw.summary).slice(0, 1000),
    facts: verifiedFacts(raw.facts, input.parts, input.images.length > 0),
    model: getLLMModel(),
  };
}

/** Replaces the item's analysis and marks the item ready with its understood fields. */
export const save = internalMutation({
  args: {
    itemId: v.id("savedItems"),
    contentTypes: v.array(vContentType),
    primaryType: vContentType,
    title: v.string(),
    summary: v.string(),
    facts: v.array(vExtractedFact),
    model: v.optional(v.string()),
  },
  handler: async (ctx, { itemId, ...analysis }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item) return null;
    const previous = await ctx.db.query("contentAnalysis").withIndex("by_itemId", (q) => q.eq("itemId", itemId)).take(20);
    for (const row of previous) await ctx.db.delete("contentAnalysis", row._id);
    const now = Date.now();
    await ctx.db.insert("contentAnalysis", { userId: item.userId, itemId, ...analysis, createdAt: now });
    await ctx.runMutation(internal.items.setExtraction, {
      itemId,
      extractionStatus: "ready",
      title: item.title ?? analysis.title,
      summary: analysis.summary,
      contentTypes: analysis.contentTypes,
      primaryType: analysis.primaryType,
    });
    await ctx.db.insert("activityEvents", {
      userId: item.userId,
      type: "analysis_completed",
      title: "Understood",
      detail: analysis.title,
      itemId,
      createdAt: now,
    });
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
    await ctx.db.insert("activityEvents", {
      userId: item.userId,
      type: "analysis_failed",
      title: extractionStatus === "needs_input" ? "Needs your input" : "Analysis failed",
      detail: extractionError,
      itemId,
      createdAt: Date.now(),
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
