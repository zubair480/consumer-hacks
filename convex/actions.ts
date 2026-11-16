import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ACTION_LABELS } from "../src/shared/contracts";
import { imageToDataUrl } from "./lib/sources";
import { buildSuggestions, isRoutedAction } from "./lib/actionCatalog";
import { getUser, requireOwned, requireOwnedItem, requireUser, getOwned, getOwnedItem } from "./lib/auth";
import { logEvent } from "./activity";
import { addItemToCollection, getOrCreateCollection } from "./collections";
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
    if (!(await getOwnedItem(ctx, ownerId, itemId))) return [];
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
        const { userId: _userId, ...suggestion } = s;
        return {
          ...suggestion,
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
    await logEvent(ctx, user._id, {
      type: "action_started",
      title: ACTION_LABELS[actionType].title,
      detail: item.title ?? item.sourceUrl,
      itemId,
      executionId,
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
      const imageUrl = input.imageUrl ? await imageToDataUrl(input.imageUrl) : null;
      const output = await EXECUTORS[input.actionType]({ ...input, imageUrl });
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
      profile: {
        name: prefs?.name,
        educationLevel: prefs?.educationLevel,
        fieldOfStudy: prefs?.fieldOfStudy,
        country: prefs?.country,
        citizenship: prefs?.citizenship,
        gpa: prefs?.gpa,
        city: prefs?.city ?? prefs?.homeCity,
        interests: prefs?.interests,
      },
      profileFacts: prefs?.profileFacts ?? {},
      inputs: execution.inputs ?? {},
      now,
    };
  },
});

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
    if (collect) {
      const collectionId = await getOrCreateCollection(ctx, item.userId, collect.kind, collect.name);
      await addItemToCollection(ctx, item, (await ctx.db.get("collections", collectionId))!);
    }
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
    await logEvent(ctx, execution.userId, {
      type: "action_completed",
      title: status === "awaiting_approval" ? `${result.title} - ready to share` : result.title,
      detail: result.summary.slice(0, 200),
      itemId: execution.itemId,
      executionId,
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
    await logEvent(ctx, execution.userId, {
      type: "action_failed",
      title: `${ACTION_LABELS[execution.actionType].title} failed`,
      detail: error,
      itemId: execution.itemId,
      executionId,
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
    const execution = await getOwned(ctx, user, executionId);
    if (!execution) return null;
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
    let row: Doc<"actionResults"> | null;
    if (resultId) row = await getOwned(ctx, user, resultId);
    else if (executionId) {
      if (!(await getOwned(ctx, user, executionId))) return null;
      row = await ctx.db
        .query("actionResults")
        .withIndex("by_executionId", (q) => q.eq("executionId", executionId))
        .first();
    } else throw new ConvexError("Pass resultId or executionId");
    if (!row) return null;
    const { userId: _userId, ...rest } = row;
    return rest;
  },
});

/** Every result for an item, newest first. */
export const listResultsForItem = query({
  args: { ownerId: vOwnerId, itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    if (!(await getOwnedItem(ctx, ownerId, itemId))) return [];
    const rows = await ctx.db
      .query("actionResults")
      .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
      .order("desc")
      .take(50);
    return rows.map(({ userId: _userId, ...rest }) => rest);
  },
});

/** Completed outcomes for Home, newest first, with the item's title and type. */
export const recentOutcomesPage = query({
  args: { ownerId: vOwnerId, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { ownerId, paginationOpts }) => {
    const user = await getUser(ctx, ownerId);
    if (!user) return { page: [], isDone: true, continueCursor: "" };
    const result = await ctx.db
      .query("actionResults")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(paginationOpts);
    const page = await Promise.all(
      result.page.map(async (row) => {
        const [item, execution] = await Promise.all([ctx.db.get("savedItems", row.itemId), ctx.db.get("actionExecutions", row.executionId)]);
        const { userId: _userId, ...rest } = row;
        return {
          ...rest,
          status: execution?.status ?? "succeeded",
          itemTitle: item?.title ?? item?.sourceUrl ?? "Saved item",
          itemPrimaryType: item?.primaryType ?? null,
        };
      }),
    );
    return { ...result, page };
  },
});

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
        const { userId: _userId, ...rest } = row;
        return {
          ...rest,
          status: execution?.status ?? "succeeded",
          itemTitle: item?.title ?? item?.sourceUrl ?? "Saved item",
          itemPrimaryType: item?.primaryType ?? null,
        };
      }),
    );
  },
});
