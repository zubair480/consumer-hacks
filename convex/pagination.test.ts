// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.ensure, { ownerId: OWNER_A });
  await t.mutation(api.users.ensure, { ownerId: OWNER_B });
  await t.run(async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      const mine = user.ownerId === OWNER_A;
      for (let i = 0; i < (mine ? 5 : 2); i++) {
        await ctx.db.insert("savedItems", { userId: user._id, sourceKind: "text", sourcePlatform: "web", contentTypes: [], searchText: "", updatedAt: i + 1, extractionStatus: "ready", title: "item " + i, createdAt: i + 1 } as never);
        await ctx.db.insert("activityEvents", { userId: user._id, type: "item_saved", title: "event " + i, createdAt: i + 1 });
      }
    }
  });
  return t;
}

describe("paginated lists", () => {
  it("walks items.listPage in newest-first pages and ends", async () => {
    const t = await setup();
    const p1 = await t.query(api.items.listPage, { ownerId: OWNER_A, paginationOpts: { numItems: 2, cursor: null } });
    expect(p1.page.map((i) => i.title)).toEqual(["item 4", "item 3"]);
    expect(p1.isDone).toBe(false);
    const p2 = await t.query(api.items.listPage, { ownerId: OWNER_A, paginationOpts: { numItems: 2, cursor: p1.continueCursor } });
    expect(p2.page.map((i) => i.title)).toEqual(["item 2", "item 1"]);
    const p3 = await t.query(api.items.listPage, { ownerId: OWNER_A, paginationOpts: { numItems: 2, cursor: p2.continueCursor } });
    expect(p3.page.map((i) => i.title)).toEqual(["item 0"]);
    expect(p3.isDone).toBe(true);
  });

  it("walks activity.listPage and only returns the owner's events", async () => {
    const t = await setup();
    const a = await t.query(api.activity.listPage, { ownerId: OWNER_A, paginationOpts: { numItems: 3, cursor: null } });
    expect(a.page.map((e) => e.title)).toEqual(["event 4", "event 3", "event 2"]);
    const b = await t.query(api.activity.listPage, { ownerId: OWNER_B, paginationOpts: { numItems: 10, cursor: null } });
    expect(b.page).toHaveLength(2);
    expect(b.isDone).toBe(true);
  });

  it("returns nothing for an unknown owner and rejects a malformed ownerId", async () => {
    const t = await setup();
    const opts = { numItems: 5, cursor: null };
    const unknown = "33333333-3333-4333-8333-333333333333";
    for (const q of [api.items.listPage, api.activity.listPage, api.actions.recentOutcomesPage]) {
      const r = await t.query(q, { ownerId: unknown, paginationOpts: opts });
      expect(r.page).toEqual([]);
      expect(r.isDone).toBe(true);
      await expect(t.query(q, { ownerId: "nope", paginationOpts: opts })).rejects.toThrow();
    }
  });
});
