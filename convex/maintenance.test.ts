// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { chunk, isStuck, MAX_INGEST_RETRIES, STUCK_AFTER_MS } from "./maintenance";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("stuck item selection", () => {
  const now = 1_000_000_000;
  it("flags only old in-flight items under the retry cap", () => {
    const old = now - STUCK_AFTER_MS - 1;
    expect(isStuck({ extractionStatus: "extracting", updatedAt: old }, now)).toBe(true);
    expect(isStuck({ extractionStatus: "pending", updatedAt: old, ingestRetries: 1 }, now)).toBe(true);
    expect(isStuck({ extractionStatus: "extracting", updatedAt: now - 1000 }, now)).toBe(false);
    expect(isStuck({ extractionStatus: "ready", updatedAt: old }, now)).toBe(false);
    expect(isStuck({ extractionStatus: "failed", updatedAt: old }, now)).toBe(false);
    expect(isStuck({ extractionStatus: "analyzing", updatedAt: old, ingestRetries: MAX_INGEST_RETRIES }, now)).toBe(false);
  });

  it("requeues stuck items and stops after the retry cap", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.users.ensure, { ownerId: OWNER_A });
    const ids = await t.run(async (ctx) => {
      const user = (await ctx.db.query("users").first())!;
      const base = { userId: user._id, sourceKind: "text" as const, sourcePlatform: "manual" as const, contentTypes: [], searchText: "", createdAt: 0 };
      const old = Date.now() - STUCK_AFTER_MS - 5000;
      const stuck = await ctx.db.insert("savedItems", { ...base, extractionStatus: "extracting", updatedAt: old });
      const fresh = await ctx.db.insert("savedItems", { ...base, extractionStatus: "extracting", updatedAt: Date.now() });
      const ready = await ctx.db.insert("savedItems", { ...base, extractionStatus: "ready", updatedAt: old });
      return { stuck, fresh, ready };
    });
    expect(await t.mutation(internal.maintenance.requeueStuck, {})).toBe(1);
    const after = await t.run((ctx) => ctx.db.get("savedItems", ids.stuck));
    expect(after?.extractionStatus).toBe("pending");
    expect(after?.ingestRetries).toBe(1);
    expect((await t.run((ctx) => ctx.db.get("savedItems", ids.ready)))?.extractionStatus).toBe("ready");
    expect((await t.run((ctx) => ctx.db.get("savedItems", ids.fresh)))?.ingestRetries).toBeUndefined();

    const restick = () => t.run((ctx) => ctx.db.patch("savedItems", ids.stuck, { extractionStatus: "extracting", updatedAt: Date.now() - STUCK_AFTER_MS - 5000 }));
    await restick();
    expect(await t.mutation(internal.maintenance.requeueStuck, {})).toBe(1);
    await restick();
    expect(await t.mutation(internal.maintenance.requeueStuck, {})).toBe(0);
  });
});

describe("auto-sync batching", () => {
  it("chunks owners into batches", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it("lists owners per connected source and skips owners with none", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.users.ensure, { ownerId: OWNER_A });
    await t.mutation(api.users.ensure, { ownerId: OWNER_B });
    await t.run(async (ctx) => {
      const a = (await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER_A)).unique())!;
      const now = Date.now();
      await ctx.db.insert("importConnections", { userId: a._id, platform: "x", externalUserId: "1", accessToken: "t", expiresAt: now, createdAt: now, updatedAt: now });
      await ctx.db.insert("githubImportAccounts", { userId: a._id, username: "octocat", createdAt: now, updatedAt: now });
    });
    const targets = await t.query(internal.maintenance.listSyncTargets, {});
    expect(targets).toHaveLength(1);
    expect(targets[0].ownerId).toBe(OWNER_A);
    expect([...targets[0].platforms].sort()).toEqual(["github", "x"]);
  });

  it("a failing source does not stop the owner's others", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.users.ensure, { ownerId: OWNER_A });
    const failures = await t.action(internal.maintenance.syncOwner, { ownerId: OWNER_A, platforms: ["x", "youtube", "github"] });
    expect(failures).toBe(3);
  });
});
