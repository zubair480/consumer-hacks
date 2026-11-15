import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { callLLMJson } from "../lib/llm";
import type { BriefFact, MediaReference } from "../../src/shared/socialContracts";
import { ADAPTERS } from "./adapters";
import type { ContentBrief } from "./adapters/types";
import { vBriefFact, vMediaReference, vPlatformOutput, vSocialContentType } from "./validators";

// OWNER: Thread H+I. Composer: builds a platform-neutral ContentBrief from the
// draft's source (saved item + contentAnalysis facts, or a mediaAsset's
// analysis) plus the user's context, then asks that platform's adapter for
// output. Each run writes a new revision on its own draft only.

const vMode = v.union(v.literal("generated"), v.literal("regenerated"));

const RELATIONSHIP_BY_TYPE: Record<string, string> = {
  restaurant:
    "The user saved this restaurant and wants to try it. They have NOT eaten there: never describe the food, service or visit as experienced. Use wording like 'Found this place and want to try it'.",
  github_repository:
    "The user found and bookmarked this repository. They did NOT build, contribute to, or maintain it, and may not have used it yet. Credit the maintainers; never say 'I built' or 'my project'.",
  code_snippet: "The user saved this code snippet. They did not write it. Credit the source.",
  recipe: "The user saved this recipe and wants to cook it. They have not made it yet.",
  travel: "The user saved this place and wants to visit. They have not been there.",
  event: "The user saved this event and is interested in it. They have not attended it.",
  product: "The user saved this product and is considering it. They have not bought or used it; no endorsement or review.",
  job: "The user saved this job posting. They have not applied or been hired.",
  scholarship: "The user saved this scholarship. They have not applied or won it.",
  application: "The user saved this application opportunity. They have not applied yet.",
  research: "The user saved this research. They did not author it. Credit the authors.",
  tutorial: "The user saved this tutorial to learn from. They did not write it.",
  graphic: "The user saved this graphic as inspiration. They did not create it; credit the creator.",
};
const DEFAULT_RELATIONSHIP =
  "The user saved this content. Do not claim they used, attended, bought, built or experienced it.";

export function mediaRelationship(kind: Doc<"mediaAssets">["kind"]): string {
  return [
    `The user saved this ${kind} to their library. It is not necessarily theirs: they may not have taken, filmed or made it, or been there.`,
    "Never claim or imply they took, captured, shot, filmed or made it, or were present ('I took this shot', 'I captured this myself', 'Captured this…').",
    `Use neutral framing such as 'This waterfall…', 'Found this shot…' or 'Look at this ${kind}…'.`,
    "Use first person about taking it or being there only when brief.userContext explicitly says so (e.g. 'I took this on my hike').",
    "Describe only what the analysis and the user's context say; do not invent where, when or who.",
  ].join(" ");
}

export const SHARED_RULES = [
  "You write social media drafts for one person, in their first-person voice.",
  "TRUTH RULES (strict):",
  "- Use only the facts in brief.facts plus brief.userContext. Never invent numbers, stars, prices, quotes, dates, names, results or achievements.",
  "- Respect brief.relationship exactly. The user context may upgrade it only if it explicitly says so (e.g. 'I ate there last night').",
  "- For a photo or video: the user saved it, which does not mean they took it, made it or were there. Never claim authorship, capture or presence unless brief.userContext explicitly says so.",
  "- No fake endorsements, testimonials or 'everyone loves it'. Opinions must be framed as curiosity or intent ('want to try', 'looks useful').",
  "- If a fact is uncertain or missing, leave it out instead of guessing.",
  "Match brief.tone and brief.audience when given. Write for THIS platform only; the output must read clearly differently from other platforms.",
].join("\n");

export function itemBrief(item: Doc<"savedItems">, analysis: Doc<"contentAnalysis"> | null): Omit<ContentBrief, "userContext" | "tone" | "audience"> {
  const source = item.sourceUrl ?? (item.imageStorageId ? "image" : "user_text");
  const facts: BriefFact[] = (analysis?.facts ?? []).map((fact) => ({
    label: fact.label,
    value: fact.value,
    source: fact.evidence.source,
    quote: fact.evidence.quote || undefined,
  }));
  const keyFacts: [string, string | undefined][] = [
    ["Location", item.location],
    ["Price", item.price],
    ["Organization", item.organization],
    ["Deadline", item.deadline],
  ];
  for (const [label, value] of keyFacts) {
    if (value && !facts.some((fact) => fact.value === value)) facts.push({ label, value, source });
  }
  if (item.sourceUrl) facts.push({ label: "Link", value: item.sourceUrl, source: item.sourceUrl });
  if (facts.length <= 1 && item.rawText) facts.push({ label: "Saved text", value: item.rawText.slice(0, 1500), source: "user_text" });
  const contentType = analysis?.primaryType ?? item.primaryType ?? "general_content";
  return {
    sourceKind: "saved_item",
    title: analysis?.title ?? item.title ?? item.sourceUrl ?? "Saved item",
    summary: analysis?.summary ?? item.summary,
    url: item.sourceUrl,
    contentType,
    facts,
    relationship: RELATIONSHIP_BY_TYPE[contentType] ?? DEFAULT_RELATIONSHIP,
  };
}

export function mediaBrief(media: Doc<"mediaAssets">): Omit<ContentBrief, "userContext" | "tone" | "audience"> {
  const a = media.analysis;
  const facts: BriefFact[] = a
    ? [
        { label: "What it shows", value: a.summary, source: "media_analysis" },
        ...(a.subjects.length ? [{ label: "Subjects", value: a.subjects.join(", "), source: "media_analysis" }] : []),
        ...(a.setting ? [{ label: "Setting", value: a.setting, source: "media_analysis" }] : []),
        ...(a.mood ? [{ label: "Mood", value: a.mood, source: "media_analysis" }] : []),
        ...(a.textInImage ? [{ label: "Text in image", value: a.textInImage, source: "media_analysis" }] : []),
      ]
    : [];
  return {
    sourceKind: "media",
    title: a?.summary ?? `Saved ${media.kind}`,
    contentType: media.kind,
    facts,
    relationship: mediaRelationship(media.kind),
  };
}

export const loadSource = internalQuery({
  args: { draftId: v.id("socialDrafts") },
  handler: async (ctx, { draftId }) => {
    const draft = await ctx.db.get(draftId);
    if (!draft) return null;
    const extras = { userContext: draft.context, tone: draft.tone, audience: draft.audience };
    const mediaReferences: MediaReference[] = [];
    let brief: ContentBrief | null = null;
    if (draft.sourceSavedItemId) {
      const item = await ctx.db.get(draft.sourceSavedItemId);
      if (item) {
        const analysis = await ctx.db
          .query("contentAnalysis")
          .withIndex("by_itemId", (q) => q.eq("itemId", item._id))
          .order("desc")
          .first();
        brief = { ...itemBrief(item, analysis), ...extras };
        if (item.imageStorageId) mediaReferences.push({ storageId: item.imageStorageId, description: "Saved screenshot" });
      }
    } else if (draft.sourceMediaId) {
      const media = await ctx.db.get(draft.sourceMediaId);
      if (media) {
        brief = { ...mediaBrief(media), ...extras };
        mediaReferences.push({ mediaId: media._id, storageId: media.storageId, description: `Saved ${media.kind}` });
      }
    }
    return brief ? { platform: draft.platform, brief, mediaReferences } : null;
  },
});

export const applyResult = internalMutation({
  args: {
    draftId: v.id("socialDrafts"),
    mode: vMode,
    output: vPlatformOutput,
    draftText: v.string(),
    contentType: vSocialContentType,
    provenance: v.array(vBriefFact),
    mediaReferences: v.array(vMediaReference),
  },
  handler: async (ctx, { draftId, mode, output, draftText, contentType, provenance, mediaReferences }) => {
    const draft = await ctx.db.get(draftId);
    if (!draft) return null;
    const now = Date.now();
    const revision = draft.revision + 1;
    await ctx.db.insert("socialDraftRevisions", { userId: draft.userId, draftId, revision, source: mode, draftText, output, createdAt: now });
    await ctx.db.patch(draftId, {
      draftText,
      output,
      contentType,
      provenance,
      mediaReferences,
      revision,
      revisionSource: mode,
      generationStatus: "ready",
      generationError: undefined,
      updatedAt: now,
    });
    return null;
  },
});

export const markFailed = internalMutation({
  args: { draftId: v.id("socialDrafts"), error: v.string() },
  handler: async (ctx, { draftId, error }) => {
    const draft = await ctx.db.get(draftId);
    if (!draft) return null;
    await ctx.db.patch(draftId, { generationStatus: "failed", generationError: error.slice(0, 300), updatedAt: Date.now() });
    return null;
  },
});

export function systemPrompt(instructions: string, mode: "generated" | "regenerated"): string {
  return `${SHARED_RULES}\n\n${instructions}${mode === "regenerated" ? "\nThis is a regeneration: take a fresh angle and different wording." : ""}`;
}

export const run = internalAction({
  args: { draftId: v.id("socialDrafts"), mode: vMode },
  handler: async (ctx, { draftId, mode }) => {
    const loaded = await ctx.runQuery(internal.social.composer.loadSource, { draftId });
    if (!loaded) {
      await ctx.runMutation(internal.social.composer.markFailed, { draftId, error: "Source not found" });
      return null;
    }
    const adapter = ADAPTERS[loaded.platform];
    try {
      const raw = await callLLMJson({
        system: systemPrompt(adapter.instructions, mode),
        user: JSON.stringify({ brief: loaded.brief }),
        schemaHint: adapter.schemaHint,
        maxOutputTokens: 1500,
        timeoutMs: 45000,
      });
      const output = adapter.normalize(raw);
      const draftText = adapter.render(output).trim();
      if (!draftText) throw new Error("The model returned an empty draft");
      await ctx.runMutation(internal.social.composer.applyResult, {
        draftId,
        mode,
        output,
        draftText,
        contentType: adapter.contentType(output),
        provenance: loaded.brief.facts,
        mediaReferences: loaded.mediaReferences as { mediaId?: Id<"mediaAssets">; storageId?: Id<"_storage">; description: string }[],
      });
    } catch (error) {
      await ctx.runMutation(internal.social.composer.markFailed, {
        draftId,
        error: error instanceof Error ? error.message : "Generation failed",
      });
    }
    return null;
  },
});
