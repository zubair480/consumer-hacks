// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const OWNER = "12121212-1212-4121-8121-121212121212";

describe("imports.sync.syncAll", () => {
  it("schedules only the syncs the owner has set up and seeds nothing", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(api.users.ensure, { ownerId: OWNER });
    expect(await t.mutation(api.imports.sync.syncAll, { ownerId: OWNER })).toEqual({ scheduled: [] });
    await t.run(async (ctx) => {
      const user = (await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER)).unique())!;
      await ctx.db.insert("githubImportAccounts", { userId: user._id, username: "zubair480", createdAt: 1, updatedAt: 1 });
    });
    expect(await t.mutation(api.imports.sync.syncAll, { ownerId: OWNER })).toEqual({ scheduled: ["github"] });
    expect(await t.run((ctx) => ctx.db.query("savedItems").collect())).toHaveLength(0);
    vi.useRealTimers();
  });

  it("throws for an unknown owner", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.imports.sync.syncAll, { ownerId: "34343434-3434-4343-8343-343434343434" })).rejects.toThrow("Unknown owner");
  });
});
