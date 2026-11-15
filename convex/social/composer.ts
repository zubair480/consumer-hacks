import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { vPlatformOutput } from "./validators";

// OWNER: Thread H+I. Composer: builds a ContentBrief from the draft's source
// and asks the platform adapter for output. Stub until the composer PR lands.

export const loadDraft = internalQuery({
  args: { draftId: v.id("socialDrafts") },
  handler: async (ctx, { draftId }) => {
    const draft = await ctx.db.get(draftId);
    if (!draft) return null;
    const item = draft.sourceSavedItemId ? await ctx.db.get(draft.sourceSavedItemId) : null;
    return { draft, title: item?.title ?? item?.sourceUrl ?? "this" };
  },
});

export const applyResult = internalMutation({
  args: {
    draftId: v.id("socialDrafts"),
    mode: v.union(v.literal("generated"), v.literal("regenerated")),
    output: vPlatformOutput,
    draftText: v.string(),
  },
  handler: async (ctx, { draftId, mode, output, draftText }) => {
    const draft = await ctx.db.get(draftId);
    if (!draft) return;
    const now = Date.now();
    const revision = draft.revision + 1;
    await ctx.db.insert("socialDraftRevisions", { userId: draft.userId, draftId, revision, source: mode, draftText, output, createdAt: now });
    await ctx.db.patch(draftId, { draftText, output, revision, revisionSource: mode, generationStatus: "ready", updatedAt: now });
  },
});

export const run = internalAction({
  args: { draftId: v.id("socialDrafts"), mode: v.union(v.literal("generated"), v.literal("regenerated")) },
  handler: async (ctx, { draftId, mode }) => {
    const loaded = await ctx.runQuery(internal.social.composer.loadDraft, { draftId });
    if (!loaded) return;
    const body = `Found ${loaded.title} and want to dig into it.`;
    await ctx.runMutation(internal.social.composer.applyResult, {
      draftId,
      mode,
      draftText: body,
      output: { platform: loaded.draft.platform, hook: body, body, hashtags: [], mediaSuggestions: [] },
    });
  },
});
