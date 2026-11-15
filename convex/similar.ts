import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { requireOwnedItem, requireUser } from "./lib/auth";
import type { SavedItemView } from "../src/shared/contracts";

// Vector search over saved items: "Similar saves" and semantic search.
// OpenAI is called only from the actions in this file.

const EMBEDDING_DIMENSIONS = 1536;
const SIMILAR_LIMIT = 5;
const EMBED_INPUT_MAX_CHARS = 8000;

export function getEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
}

async function embedText(input: string): Promise<{ vector: number[]; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set on the Convex deployment");
  const model = getEmbeddingModel();
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: input.slice(0, EMBED_INPUT_MAX_CHARS) }),
  });
  if (!response.ok) throw new Error(`OpenAI embeddings failed (${response.status})`);
  const json = (await response.json()) as { data?: { embedding?: number[] }[] };
  const vector = json.data?.[0]?.embedding;
  if (!vector || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected a ${EMBEDDING_DIMENSIONS}-dimension embedding from ${model}`);
  }
  return { vector, model };
}

export const getEmbeddingSource = internalQuery({
  args: { itemId: v.id("savedItems") },
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item || item.extractionStatus !== "ready") return null;
    const analysis = await ctx.db.query("contentAnalysis").withIndex("by_itemId", (q) => q.eq("itemId", itemId)).first();
    const facts = analysis?.facts.map((f) => `${f.label}: ${f.value}`) ?? [];
    const keyFacts = [item.deadline, item.location, item.price, item.organization].filter((f): f is string => Boolean(f));
    const text = [item.title, item.summary, ...facts, ...keyFacts].filter(Boolean).join("\n");
    return text ? { userId: item.userId, text } : null;
  },
});

export const saveEmbedding = internalMutation({
  args: { userId: v.id("users"), itemId: v.id("savedItems"), embedding: v.array(v.float64()), model: v.string() },
  handler: async (ctx, { userId, itemId, embedding, model }) => {
    const previous = await ctx.db.query("itemEmbeddings").withIndex("by_itemId", (q) => q.eq("itemId", itemId)).take(10);
    for (const row of previous) await ctx.db.delete("itemEmbeddings", row._id);
    await ctx.db.insert("itemEmbeddings", { userId, itemId, embedding, model, createdAt: Date.now() });
    return null;
  },
});

/** Embeds title + summary + facts for one ready item. */
export const embedItem = internalAction({
  args: { itemId: v.id("savedItems") },
  handler: async (ctx, { itemId }): Promise<null> => {
    const source: { userId: Id<"users">; text: string } | null = await ctx.runQuery(internal.similar.getEmbeddingSource, { itemId });
    if (!source) return null;
    try {
      const { vector, model } = await embedText(source.text);
      await ctx.runMutation(internal.similar.saveEmbedding, { userId: source.userId, itemId, embedding: vector, model });
    } catch (error) {
      console.warn("embedItem failed", itemId, error instanceof Error ? error.message : error);
    }
    return null;
  },
});

export const listUnembedded = internalQuery({
  args: { cursor: v.union(v.string(), v.null()), numItems: v.number(), newestFirst: v.optional(v.boolean()) },
  handler: async (ctx, { cursor, numItems, newestFirst }) => {
    const page = await ctx.db
      .query("savedItems")
      .order(newestFirst ? "desc" : "asc")
      .paginate({ cursor, numItems });
    const missing: Id<"savedItems">[] = [];
    for (const item of page.page) {
      if (item.extractionStatus !== "ready") continue;
      const existing = await ctx.db.query("itemEmbeddings").withIndex("by_itemId", (q) => q.eq("itemId", item._id)).first();
      if (!existing) missing.push(item._id);
    }
    return { missing, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/** Embeds every ready item that has no vector yet: `npx convex run similar:backfill`. */
export const backfill = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    let cursor: string | null = null;
    let embedded = 0;
    while (true) {
      const page: { missing: Id<"savedItems">[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(
        internal.similar.listUnembedded,
        { cursor, numItems: 50 },
      );
      for (const itemId of page.missing) {
        await ctx.runAction(internal.similar.embedItem, { itemId });
        embedded += 1;
      }
      if (page.isDone) return embedded;
      cursor = page.continueCursor;
    }
  },
});

/** Cron sweep: embeds ready items among the newest saves that have no vector yet. */
export const sweepRecent = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const page: { missing: Id<"savedItems">[] } = await ctx.runQuery(internal.similar.listUnembedded, { cursor: null, numItems: 25, newestFirst: true });
    for (const itemId of page.missing) await ctx.runAction(internal.similar.embedItem, { itemId });
    return page.missing.length;
  },
});

export const checkOwnedItem = internalQuery({
  args: { ownerId: v.string(), itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }) => {
    const { user } = await requireOwnedItem(ctx, ownerId, itemId);
    const row = await ctx.db.query("itemEmbeddings").withIndex("by_itemId", (q) => q.eq("itemId", itemId)).first();
    return { userId: user._id, embedding: row?.embedding ?? null };
  },
});

export const checkOwner = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => (await requireUser(ctx, ownerId))._id,
});

export const hydrate = internalQuery({
  args: { userId: v.id("users"), ids: v.array(v.id("itemEmbeddings")), excludeItemId: v.optional(v.id("savedItems")), limit: v.number() },
  handler: async (ctx, { userId, ids, excludeItemId, limit }) => {
    const views: SavedItemView[] = [];
    for (const id of ids) {
      const row = await ctx.db.get("itemEmbeddings", id);
      if (!row || row.userId !== userId || row.itemId === excludeItemId) continue;
      const item: Doc<"savedItems"> | null = await ctx.db.get("savedItems", row.itemId);
      if (!item || item.userId !== userId) continue;
      const { userId: _u, searchText: _s, collectionIds: _c, ...rest } = item;
      views.push({ ...rest, imageUrl: item.imageStorageId ? await ctx.storage.getUrl(item.imageStorageId) : null });
      if (views.length >= limit) break;
    }
    return views;
  },
});

/** Top 5 saves most similar to this one, owner-scoped, excluding the item itself. */
export const forItem = action({
  args: { ownerId: v.string(), itemId: v.id("savedItems") },
  handler: async (ctx, { ownerId, itemId }): Promise<SavedItemView[]> => {
    const { userId, embedding } = await ctx.runQuery(internal.similar.checkOwnedItem, { ownerId, itemId });
    if (!embedding) return [];
    const hits = await ctx.vectorSearch("itemEmbeddings", "by_embedding", {
      vector: embedding,
      limit: SIMILAR_LIMIT + 2,
      filter: (q) => q.eq("userId", userId),
    });
    return await ctx.runQuery(internal.similar.hydrate, {
      userId,
      ids: hits.map((h) => h._id),
      excludeItemId: itemId,
      limit: SIMILAR_LIMIT,
    });
  },
});

/** Semantic search over the owner's saves. */
export const search = action({
  args: { ownerId: v.string(), query: v.string() },
  handler: async (ctx, { ownerId, query }): Promise<SavedItemView[]> => {
    const userId = await ctx.runQuery(internal.similar.checkOwner, { ownerId });
    const text = query.trim();
    if (!text) return [];
    const { vector } = await embedText(text);
    const hits = await ctx.vectorSearch("itemEmbeddings", "by_embedding", {
      vector,
      limit: 10,
      filter: (q) => q.eq("userId", userId),
    });
    return await ctx.runQuery(internal.similar.hydrate, { userId, ids: hits.map((h) => h._id), limit: 10 });
  },
});
