// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules, registerComponents } from "../test.setup";
import { backgroundPool } from "./pools";

const OWNER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("backgroundPool", () => {
  it("runs enqueued jobs", async () => {
    const t = registerComponents(convexTest(schema, modules));
    await t.mutation(api.users.ensure, { ownerId: OWNER });
    const userId = await t.run(async (ctx) => (await ctx.db.query("users").first())!._id);
    await t.run(async (ctx) => {
      for (let i = 0; i < 8; i++) {
        await backgroundPool.enqueueMutation(ctx, internal.activity.log, { userId, type: "item_saved", title: `job ${i}` });
      }
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const events = await t.run((ctx) => ctx.db.query("activityEvents").collect());
    expect(events.map((e) => e.title).sort()).toEqual(Array.from({ length: 8 }, (_, i) => `job ${i}`));
  });
});
