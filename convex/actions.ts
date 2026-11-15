import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ACTION_LABELS } from "../src/shared/contracts";
import { buildSuggestions, isRoutedAction } from "./lib/actionCatalog";
import { getUser, requireOwned, requireOwnedItem, requireUser } from "./lib/auth";
import { EXECUTORS, ExecutorError, type ExecutorInput } from "./lib/executors";
import { vActionResultDocument, vActionType, vCollectionKind, vOwnerId } from "./lib/validators";

// OWNER: D+E. Contextual action routing and execution.
// suggestForItem (scheduled by analysis) -> listSuggestions -> execute ->
// run (executor action) -> actionResults + actionExecutions + activityEvents.

const MAX_INPUT_CHARS = 2000;

async function latestAnalysis(ctx: QueryCtx, itemId: Id<"savedItems">) {
  return await ctx.db
    .query("contentAnalysis")
    .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
    .order("desc")
    .first();
}

/* ------------------------------ suggestions ------------------------------ */

/** Replaces the item's suggestions with the three ranked actions for its analysis. */
export const suggestForItem = internalMutation({
  args: { itemId: v.id("savedItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item) return null;
    const analysis = await latestAnalysis(ctx, itemId);
    const suggestions = buildSuggestions(analysis?.primaryType ?? item.primaryType, analysis?.facts ?? []);
    const existing = await ctx.db
      .query("actionSuggestions")
      .withIndex("by_itemId_and_rank", (q) => q.eq("itemId", itemId))
      .take(50);
    for (const row of existing) await ctx.db.delete("actionSuggestions", row._id);
    const now = Date.now();
    for (const s of suggestions) {
      await ctx.db.insert("actionSuggestions", { ...s, userId: item.userId, itemId, createdAt: now });
    }
    return null;
  },
});

/**
 * The item's ranked suggestions, each with its latest execution (if any) so
 * the UI can show "Running…" or "View result".
 */
export const listSuggestions = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    await requireOwnedItem(ctx, ownerId, itemId);
    const [suggestions, executions] = await Promise.all([
      ctx.db
        .query("actionSuggestions")
        .withIndex("by_itemId_and_rank", (q) => q.eq("itemId", itemId))
        .take(20),
      ctx.db
        .query("actionExecutions")
        .withIndex("by_itemId_and_createdAt", (q) => q.eq("itemId", itemId))
        .order("desc")
        .take(50),
    ]);
    return await Promise.all(
      suggestions.map(async (s) => {
        const latest = executions.find((e) => e.actionType === s.actionType) ?? null;
        const result = latest
          ? await ctx.db
              .query("actionResults")
              .withIndex("by_executionId", (q) => q.eq("executionId", latest._id))
              .first()
          : null;
        return {
          ...s,
          latestExecution: latest
            ? { _id: latest._id, status: latest.status, error: latest.error ?? null, resultId: result?._id ?? null, createdAt: latest.createdAt }
            : null,
        };
      }),
    );
  },
});

/* ------------------------------- execution ------------------------------- */

/**
 * Starts an action. Pass suggestionId, or itemId + actionType. Returns the
 * executionId; an identical action already queued/running is reused.
 */
export const execute = mutation({
  args: {
    ownerId: vOwnerId,
    suggestionId: v.optional(v.id("actionSuggestions")),
    itemId: v.optional(v.id("savedItems")),
    actionType: v.optional(vActionType),
    inputs: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.ownerId);
    const suggestion = args.suggestionId ? await requireOwned(ctx, user, args.suggestionId) : null;
    const itemId = suggestion?.itemId ?? args.itemId;
    const actionType = suggestion?.actionType ?? args.actionType;
    if (!itemId || !actionType) throw new ConvexError("Pass suggestionId, or itemId and actionType");
    if (suggestion && args.itemId && args.itemId !== suggestion.itemId) throw new ConvexError("Suggestion does not belong to this item");
    const item = await requireOwned(ctx, user, itemId);
    if (item.extractionStatus !== "ready") throw new ConvexError("This save is still being understood. Try again in a moment.");

    const analysis = await latestAnalysis(ctx, itemId);
    const primaryType = analysis?.primaryType ?? item.primaryType;
    if (!isRoutedAction(primaryType, actionType)) throw new ConvexError("That action isn't available for this save");
    const spec = buildSuggestions(primaryType, analysis?.facts ?? []).find((s) => s.actionType === actionType);
    if (spec && !spec.canExecute) throw new ConvexError(spec.description);

    const inputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(args.inputs ?? {})) {
      if (value.length > MAX_INPUT_CHARS) throw new ConvexError(`"${key}" is too long`);
      if (value.trim()) inputs[key] = value.trim();
    }
    for (const input of spec?.requiredInputs ?? []) {
      if (input.required && !inputs[input.key]) throw new ConvexError(`${input.label} is required`);
    }

    const recent = await ctx.db
      .query("actionExecutions")
      .withIndex("by_itemId_and_createdAt", (q) => q.eq("itemId", itemId))
      .order("desc")
      .take(20);
    const inFlight = recent.find((e) => e.actionType === actionType && (e.status === "queued" || e.status === "running"));
    if (inFlight) return inFlight._id;

    const now = Date.now();
    const executionId = await ctx.db.insert("actionExecutions", {
      userId: user._id,
      itemId,
      suggestionId: suggestion?._id,
      actionType,
      status: "queued",
      inputs,
      createdAt: now,
    });
    await ctx.db.insert("activityEvents", {
      userId: user._id,
      type: "action_started",
      title: ACTION_LABELS[actionType].title,
      detail: item.title ?? item.sourceUrl,
      itemId,
      executionId,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.actions.run, { executionId });
    return executionId;
  },
});

/** Runs the executor for one execution and stores its ActionResultDocument. */
export const run = internalAction({
  args: { executionId: v.id("actionExecutions") },
  handler: async (ctx, { executionId }) => {
    const input: ExecutorInput | null = await ctx.runMutation(internal.actions.startRun, { executionId, now: Date.now() });
    if (!input) return null;
    try {
      const output = await EXECUTORS[input.actionType](input);
      await ctx.runMutation(internal.actions.completeRun, {
        executionId,
        result: output.result,
        status: output.status,
        collect: output.collect,
      });
    } catch (error) {
      const message =
        error instanceof ExecutorError
          ? error.message
          : error instanceof Error && /no readable content|not contain enough/i.test(error.message)
            ? error.message
            : "Something went wrong running this action. Please try again.";
      console.error(`action ${input.actionType} failed`, error);
      await ctx.runMutation(internal.actions.failRun, { executionId, error: message });
    }
    return null;
  },
});

/** Marks the execution running and returns everything the executor may read. */
export const startRun = internalMutation({
  args: { executionId: v.id("actionExecutions"), now: v.number() },
  handler: async (ctx, { executionId, now }): Promise<ExecutorInput | null> => {
    const execution = await ctx.db.get("actionExecutions", executionId);
    if (!execution || execution.status !== "queued") return null;
    const item = await ctx.db.get("savedItems", execution.itemId);
    if (!item) {
      await ctx.db.patch("actionExecutions", executionId, { status: "failed", error: "The saved item was deleted", completedAt: now });
      return null;
    }
    await ctx.db.patch("actionExecutions", executionId, { status: "running", startedAt: now });
    const [analysis, prefs] = await Promise.all([
      latestAnalysis(ctx, item._id),
      ctx.db
        .query("userPreferences")
        .withIndex("by_userId", (q) => q.eq("userId", item.userId))
        .first(),
    ]);
    return {
      actionType: execution.actionType,
      item: {
        title: item.title,
        summary: item.summary,
        sourceUrl: item.sourceUrl,
        sourcePlatform: item.sourcePlatform,
        rawText: item.rawText,
        primaryType: item.primaryType,
        contentTypes: item.contentTypes,
      },
      imageUrl: item.imageStorageId ? await ctx.storage.getUrl(item.imageStorageId) : null,
      analysis: analysis
        ? { title: analysis.title, summary: analysis.summary, facts: analysis.facts, primaryType: analysis.primaryType }
        : null,
      profileFacts: prefs?.profileFacts ?? {},
      homeCity: prefs?.homeCity,
      inputs: execution.inputs ?? {},
      now,
    };
  },
});

async function addToCollection(ctx: MutationCtx, item: Doc<"savedItems">, kind: Doc<"collections">["kind"], name: string) {
  const now = Date.now();
  const collections = await ctx.db
    .query("collections")
    .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", item.userId))
    .take(200);
  const found = collections.find((c) => c.kind === kind && c.name.toLowerCase() === name.toLowerCase());
  const collectionId =
    found?._id ??
    (await ctx.db.insert("collections", { userId: item.userId, name, kind, coverItemId: item._id, createdAt: now, updatedAt: now }));
  if (found) await ctx.db.patch("collections", found._id, { updatedAt: now });
  const ids = item.collectionIds ?? [];
  if (!ids.includes(collectionId)) await ctx.db.patch("savedItems", item._id, { collectionIds: [...ids, collectionId], updatedAt: now });
  await ctx.db.insert("activityEvents", {
    userId: item.userId,
    type: "collection_updated",
    title: `Added to ${name}`,
    detail: item.title ?? item.sourceUrl,
    itemId: item._id,
    collectionId,
    createdAt: now,
  });
}

export const completeRun = internalMutation({
  args: {
    executionId: v.id("actionExecutions"),
    result: vActionResultDocument,
    status: v.union(v.literal("succeeded"), v.literal("awaiting_approval")),
    collect: v.optional(v.object({ kind: vCollectionKind, name: v.string() })),
  },
  handler: async (ctx, { executionId, result, status, collect }) => {
    const execution = await ctx.db.get("actionExecutions", executionId);
    if (!execution) return null;
    const item = await ctx.db.get("savedItems", execution.itemId);
    if (!item) {
      await ctx.db.patch("actionExecutions", executionId, { status: "failed", error: "The saved item was deleted", completedAt: Date.now() });
      return null;
    }
    const now = Date.now();
    if (collect) await addToCollection(ctx, item, collect.kind, collect.name);
    await ctx.db.insert("actionResults", {
      userId: execution.userId,
      itemId: execution.itemId,
      executionId,
      actionType: execution.actionType,
      result,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("actionExecutions", executionId, { status, error: undefined, completedAt: now });
    await ctx.db.insert("activityEvents", {
      userId: execution.userId,
      type: "action_completed",
      title: status === "awaiting_approval" ? `${result.title} - ready to send` : result.title,
      detail: result.summary.slice(0, 200),
      itemId: execution.itemId,
      executionId,
      createdAt: now,
    });
    return null;
  },
});

export const failRun = internalMutation({
  args: { executionId: v.id("actionExecutions"), error: v.string() },
  handler: async (ctx, { executionId, error }) => {
    const execution = await ctx.db.get("actionExecutions", executionId);
    if (!execution) return null;
    const now = Date.now();
    await ctx.db.patch("actionExecutions", executionId, { status: "failed", error, completedAt: now });
    await ctx.db.insert("activityEvents", {
      userId: execution.userId,
      type: "action_failed",
      title: `${ACTION_LABELS[execution.actionType].title} failed`,
      detail: error,
      itemId: execution.itemId,
      executionId,
      createdAt: now,
    });
    return null;
  },
});

/* -------------------------------- reading -------------------------------- */

/** One execution plus its result id (null until it finishes). */
export const getExecution = query({
  args: { ownerId: vOwnerId, executionId: v.id("actionExecutions") },
  handler: async (ctx, { ownerId, executionId }) => {
    const user = await requireUser(ctx, ownerId);
    const execution = await requireOwned(ctx, user, executionId);
    const result = await ctx.db
      .query("actionResults")
      .withIndex("by_executionId", (q) => q.eq("executionId", executionId))
      .first();
    const { userId: _userId, ...rest } = execution;
    return { ...rest, resultId: result?._id ?? null };
  },
});

/** An actionResults row (result: ActionResultDocument) by resultId or executionId; null while running. */
export const getResult = query({
  args: { ownerId: vOwnerId, resultId: v.optional(v.id("actionResults")), executionId: v.optional(v.id("actionExecutions")) },
  handler: async (ctx, { ownerId, resultId, executionId }) => {
    const user = await requireUser(ctx, ownerId);
    if (resultId) return await requireOwned(ctx, user, resultId);
    if (!executionId) throw new ConvexError("Pass resultId or executionId");
    await requireOwned(ctx, user, executionId);
    return await ctx.db
      .query("actionResults")
      .withIndex("by_executionId", (q) => q.eq("executionId", executionId))
      .first();
  },
});

/** Every result for an item, newest first. */
export const listResultsForItem = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    await requireOwnedItem(ctx, ownerId, itemId);
    return await ctx.db
      .query("actionResults")
      .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
      .order("desc")
      .take(50);
  },
});

/** Completed outcomes for Home, newest first, with the item's title and type. */
export const recentOutcomes = query({
  args: { ownerId: vOwnerId, limit: v.optional(v.number()) },
  handler: async (ctx, { ownerId, limit }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return [];
    const rows = await ctx.db
      .query("actionResults")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(Math.min(Math.max(limit ?? 10, 1), 50));
    return await Promise.all(
      rows.map(async (row) => {
        const [item, execution] = await Promise.all([ctx.db.get("savedItems", row.itemId), ctx.db.get("actionExecutions", row.executionId)]);
        return {
          ...row,
          status: execution?.status ?? "succeeded",
          itemTitle: item?.title ?? item?.sourceUrl ?? "Saved item",
          itemPrimaryType: item?.primaryType ?? null,
        };
      }),
    );
  },
});
