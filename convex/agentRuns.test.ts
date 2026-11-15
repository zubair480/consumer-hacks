// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { buildRunRepoResult, LOG_TAIL_CHARS, runRepoInSandbox, type CommandOutcome, type Runner } from "./lib/runRepo";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.ensure, { ownerId: OWNER_A });
  await t.mutation(api.users.ensure, { ownerId: OWNER_B });
  const itemId = await t.run(async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER_A))
      .unique();
    const now = Date.now();
    return await ctx.db.insert("savedItems", {
      userId: user!._id,
      sourceKind: "url",
      sourceUrl: "https://github.com/jonschlinkert/is-number",
      sourcePlatform: "github",
      extractionStatus: "ready",
      primaryType: "github_repository",
      contentTypes: ["github_repository"],
      searchText: "is-number",
      createdAt: now,
      updatedAt: now,
    } as never);
  });
  return { t, itemId };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("E2B_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("agentRuns.startRunRepo", () => {
  it("creates a queued run_repo execution and schedules the agent action", async () => {
    const { t, itemId } = await setup();
    expect(await t.query(api.agentRuns.runRepoAvailable, { ownerId: OWNER_A })).toBe(true);
    const executionId = await t.mutation(api.agentRuns.startRunRepo, { ownerId: OWNER_A, itemId });
    const { execution, scheduled } = await t.run(async (ctx) => ({
      execution: await ctx.db.get(executionId),
      scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(execution).toMatchObject({ actionType: "run_repo", status: "queued" });
    expect(scheduled.map((s) => s.name)).toEqual(["agentMode:runRepo"]);
    expect(await t.mutation(api.agentRuns.startRunRepo, { ownerId: OWNER_A, itemId })).toBe(executionId);
    expect(await t.query(api.agentRuns.latestRunRepo, { ownerId: OWNER_A, itemId })).toMatchObject({ _id: executionId, status: "queued" });
  });

  it("is not reachable through actions.execute", async () => {
    const { t, itemId } = await setup();
    await expect(t.mutation(api.actions.execute, { ownerId: OWNER_A, itemId, actionType: "run_repo" })).rejects.toThrow(/isn't available/);
  });

  it("refuses another owner's item", async () => {
    const { t, itemId } = await setup();
    await expect(t.mutation(api.agentRuns.startRunRepo, { ownerId: OWNER_B, itemId })).rejects.toThrow(/Not found/);
    await expect(t.query(api.agentRuns.latestRunRepo, { ownerId: OWNER_B, itemId })).rejects.toThrow(/Not found/);
    await expect(t.mutation(api.agentRuns.startRunRepo, { ownerId: "not-a-uuid", itemId })).rejects.toThrow();
  });

  it("reports unavailable and refuses when the key is not configured", async () => {
    vi.stubEnv("E2B_API_KEY", "");
    const { t, itemId } = await setup();
    expect(await t.query(api.agentRuns.runRepoAvailable, { ownerId: OWNER_A })).toBe(false);
    await expect(t.mutation(api.agentRuns.startRunRepo, { ownerId: OWNER_A, itemId })).rejects.toThrow(/configured/);
  });
});

function mockRunner(overrides: Record<string, Partial<CommandOutcome>>): { runner: Runner; commands: string[] } {
  const commands: string[] = [];
  const runner: Runner = async (command) => {
    commands.push(command);
    const key = Object.keys(overrides).find((k) => command.startsWith(k));
    return { command, exitCode: 0, stdout: "", stderr: "", durationMs: 100, ...(key ? overrides[key] : {}) };
  };
  return { runner, commands };
}

const probe = (pkg: object) => ({ stdout: `.\npackage.json\npackage-lock.json\nindex.js\n---PKG---\n${JSON.stringify(pkg)}\n---README---\n# is-number` });

describe("run_repo result shaping", () => {
  it("runs npm ci and npm test for a Node repo and reports a pass", async () => {
    const { runner, commands } = mockRunner({ "ls -1a": probe({ scripts: { test: "mocha" } }), "npm test": { stdout: "12 passing" } });
    const doc = buildRunRepoResult(await runRepoInSandbox(runner, "https://github.com/jonschlinkert/is-number"));
    expect(commands.some((c) => c.startsWith("git clone --depth 1 https://github.com/jonschlinkert/is-number.git"))).toBe(true);
    expect(commands).toContain("npm ci --no-audit --no-fund");
    expect(commands).toContain("npm test");
    expect(doc.title).toBe("Passed: Tests passed");
    expect(doc.actionType).toBe("run_repo");
    expect(doc.sections.map((s) => s.heading)).toEqual(["Run", "Steps", "Output"]);
    expect(doc.sections[0]).toMatchObject({ kind: "key_value" });
  });

  it("keeps failing tests as a result, with the verdict in the title and logs truncated", async () => {
    const huge = "x".repeat(20_000);
    const { runner } = mockRunner({ "ls -1a": probe({ scripts: { test: "mocha" } }), "npm test": { exitCode: 1, stdout: huge, stderr: `${huge}END` } });
    const doc = buildRunRepoResult(await runRepoInSandbox(runner, "https://github.com/a/b"));
    expect(doc.title).toBe("Failed: Tests failed");
    const output = doc.sections.find((s) => s.heading === "Output");
    const errors = doc.sections.find((s) => s.heading === "Errors");
    expect(output?.kind === "code" && output.code.length).toBeLessThanOrEqual(LOG_TAIL_CHARS + 20);
    expect(errors?.kind === "code" && errors.code.endsWith("END")).toBe(true);
  });

  it("does not throw when the clone fails", async () => {
    const { runner } = mockRunner({ "git clone": { exitCode: 128, stderr: "not found" } });
    const doc = buildRunRepoResult(await runRepoInSandbox(runner, "https://github.com/a/missing"));
    expect(doc.title).toBe("Failed: Could not clone");
  });
});
