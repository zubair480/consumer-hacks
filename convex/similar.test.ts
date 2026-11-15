// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

function vec(i: number): number[] {
  const v = new Array(1536).fill(0);
  v[i] = 1;
  v[(i + 1) % 1536] = 0.5;
  return v;
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: [{ embedding: vec(0) }] }), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function seed() {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.ensure, { ownerId: OWNER_A });
  await t.mutation(api.users.ensure, { ownerId: OWNER_B });
  const ids = await t.run(async (ctx) => {
    const a = (await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER_A)).unique())!;
    const b = (await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER_B)).unique())!;
    const mk = async (userId: Id<"users">, title: string, i: number) => {
      const itemId = await ctx.db.insert("savedItems", {
        userId,
        sourceKind: "text",
        sourcePlatform: "manual",
        rawText: title,
        title,
        summary: title + " summary",
        contentTypes: ["scholarship"],
        primaryType: "scholarship",
        extractionStatus: "ready",
        searchText: title.toLowerCase(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as never);
      await ctx.db.insert("itemEmbeddings", { userId, itemId, embedding: vec(i), model: "test", createdAt: Date.now() });
      return itemId;
    };
    return {
      self: await mk(a._id, "self", 0),
      near: await mk(a._id, "near", 1),
      far: await mk(a._id, "far", 700),
      foreign: await mk(b._id, "foreign", 0),
    };
  });
  return { t, ...ids };
}

describe("similar.forItem", () => {
  it("returns the owner's similar saves, excluding the item itself and other users' items", async () => {
    const { t, self, near, far, foreign } = await seed();
    const rows = await t.action(api.similar.forItem, { ownerId: OWNER_A, itemId: self });
    const found = rows.map((r) => r._id);
    expect(found).not.toContain(self);
    expect(found).not.toContain(foreign);
    expect(found).toEqual([near, far]);
  });

  it("refuses an item owned by someone else", async () => {
    const { t, foreign } = await seed();
    await expect(t.action(api.similar.forItem, { ownerId: OWNER_A, itemId: foreign })).rejects.toThrow(/Not found/);
  });

  it("returns an empty list when the item has no embedding yet", async () => {
    const { t, self } = await seed();
    await t.run(async (ctx) => {
      const row = await ctx.db.query("itemEmbeddings").withIndex("by_itemId", (q) => q.eq("itemId", self)).unique();
      await ctx.db.delete(row!._id);
    });
    expect(await t.action(api.similar.forItem, { ownerId: OWNER_A, itemId: self })).toEqual([]);
  });
});

describe("similar.search", () => {
  it("embeds the query (mocked) and returns only the owner's saves", async () => {
    const { t, self, near, foreign } = await seed();
    const rows = await t.action(api.similar.search, { ownerId: OWNER_A, query: "anything" });
    const found = rows.map((r) => r._id);
    expect(found).toContain(self);
    expect(found).toContain(near);
    expect(found).not.toContain(foreign);
  });
});

describe("similar.embedItem", () => {
  it("stores an embedding for a ready item using the mocked OpenAI response", async () => {
    const { t, self } = await seed();
    await t.run(async (ctx) => {
      const row = await ctx.db.query("itemEmbeddings").withIndex("by_itemId", (q) => q.eq("itemId", self)).unique();
      await ctx.db.delete(row!._id);
    });
    await t.action(internal.similar.embedItem, { itemId: self });
    const count = await t.run(async (ctx) => (await ctx.db.query("itemEmbeddings").withIndex("by_itemId", (q) => q.eq("itemId", self)).collect()).length);
    expect(count).toBe(1);
  });
});
