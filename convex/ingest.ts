import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { analyzeContent } from "./analysis";
import { fetchUrl, imageToDataUrl, type SourcePart } from "./lib/sources";

// OWNER: Thread B+C. Ingestion pipeline scheduled by items.create / items.retry:
// pending -> extracting -> analyzing -> ready | needs_input | failed.

/** D+E's suggestion generator; referenced by name so ingestion still works before it lands. */
const suggestForItem = makeFunctionReference<"action", { itemId: Id<"savedItems"> }>("actions:suggestForItem");

function hostTitle(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export const run = internalAction({
  args: { itemId: v.id("savedItems") },
  handler: async (ctx, { itemId }) => {
    const loaded = await ctx.runQuery(internal.items.getForProcessing, { itemId });
    if (!loaded) return null;
    const { item, imageUrl } = loaded;

    try {
      await ctx.runMutation(internal.analysis.markStarted, { itemId });

      const parts: SourcePart[] = [];
      const images: string[] = [];
      let linkProblem: string | undefined;
      let fetchedTitle: string | undefined;

      if (item.sourceUrl) {
        const fetched = await fetchUrl(item.sourceUrl);
        if (fetched.ok) {
          parts.push(fetched.part);
          fetchedTitle = fetched.title;
        } else {
          linkProblem = fetched.reason;
          parts.push({ source: item.sourceUrl, label: "Saved link (could not be opened)", text: `URL: ${item.sourceUrl}` });
        }
      }
      if (item.rawText) parts.push({ source: "user_text", label: "Text the user pasted", text: item.rawText });
      if (imageUrl) images.push(await imageToDataUrl(imageUrl));

      if (!parts.length && !images.length) {
        await ctx.runMutation(internal.analysis.markProblem, {
          itemId,
          extractionStatus: "needs_input",
          extractionError: "There's nothing to analyze yet. Add a link, text, or a screenshot.",
        });
        return null;
      }

      await ctx.runMutation(internal.items.setExtraction, { itemId, extractionStatus: "analyzing" });
      const analysis = await analyzeContent({
        parts,
        images,
        sourceAccessible: !linkProblem,
        fallbackTitle: fetchedTitle ?? (item.sourceUrl ? hostTitle(item.sourceUrl) : undefined),
      });
      await ctx.runMutation(internal.analysis.save, {
        itemId,
        ...analysis,
        extractionStatus: linkProblem && !item.rawText && !images.length ? "needs_input" : "ready",
        extractionError: linkProblem && !item.rawText && !images.length ? linkProblem : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("ingest failed", itemId, message);
      await ctx.runMutation(internal.analysis.markProblem, {
        itemId,
        extractionStatus: "failed",
        extractionError: `We couldn't analyze this save. Tap retry. (${message.slice(0, 200)})`,
      });
      return null;
    }

    try {
      await ctx.scheduler.runAfter(0, suggestForItem, { itemId });
    } catch (error) {
      console.warn("actions.suggestForItem unavailable; skipping suggestions", error instanceof Error ? error.message : error);
    }
    return null;
  },
});
