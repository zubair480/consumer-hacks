// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER = "88888888-8888-4888-8888-888888888888";

describe("item screen queries after delete", () => {
  it("return null or [] instead of throwing", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const itemId = await t.mutation(api.items.create, { ownerId: OWNER, rawText: "Zapy Demo Night, Sunday Nov 15, 7 PM" });
    const executionId = await t.run(async (ctx) => {
      const item = (await ctx.db.get(itemId))!;
      return await ctx.db.insert("actionExecutions", { userId: item.userId, itemId, actionType: "summarize", status: "succeeded", inputs: {}, createdAt: Date.now() });
    });
    await t.mutation(api.items.remove, { ownerId: OWNER, itemId });
    const args = { ownerId: OWNER, itemId };
    expect(await t.query(api.items.get, args)).toBeNull();
    expect(await t.query(api.analysis.getForItem, args)).toBeNull();
    expect(await t.query(api.actions.listSuggestions, args)).toEqual([]);
    expect(await t.query(api.actions.listResultsForItem, args)).toEqual([]);
    expect(await t.query(api.activity.listForItem, args)).toEqual([]);
    expect(await t.query(api.agentRuns.latestRunRepo, args)).toBeNull();
    expect(await t.query(api.demo.primaryAction, args)).toBeNull();
    expect(await t.query(api.agents.calendar.latestForItem, args)).toBeNull();
    expect(await t.query(api.formFill.latestForItem, args)).toBeNull();
    expect(await t.query(api.actions.getExecution, { ownerId: OWNER, executionId })).toBeNull();
    expect(await t.query(api.actions.getResult, { ownerId: OWNER, executionId })).toBeNull();
    await expect(t.query(api.items.get, { ownerId: "99999999-9999-4999-8999-999999999999", itemId })).rejects.toThrow("Unknown owner");
    vi.useRealTimers();
  });
});
