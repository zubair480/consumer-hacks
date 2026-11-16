// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { HOLD_MS, assertSafeInstruction } from "./lib/formGuard";
import { modules } from "./test.setup";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

const acts: string[] = [];
let wall = false;
let launchFails = false;
const closed = { stagehand: 0, browser: 0 };
vi.mock("@browserbasehq/stagehand", () => ({
  browserbase: {
    launch: async () => {
      if (launchFails) throw new Error("Failed to upload the Stagehand extension to Browserbase after 1 attempt(s).");
      return { sessionId: "sess", context: { pages: async () => [{ goto: async () => {}, screenshot: async () => new Uint8Array([1, 2, 3]) }] }, close: async () => { closed.browser++; } };
    },
  },
  Stagehand: {
    create: async () => ({
      extract: async (instruction: string) =>
        instruction.startsWith("Is this page")
          ? { data: { blocked: wall, reason: wall ? "login wall" : "" } }
          : { data: { fields: [{ label: "Full name", kind: "text" }, { label: "Password", kind: "text" }, { label: "Essay", kind: "textarea" }] } },
      act: async (instruction: string) => { acts.push(instruction); },
      close: async () => { closed.stagehand++; },
    }),
  },
}));
vi.mock("@browserbasehq/sdk", () => ({ default: class { sessions = { debug: async () => ({ debuggerFullscreenUrl: "https://live.example/x" }) }; } }));
vi.mock("./lib/llm", () => ({ getLLMModel: () => "m", callLLMJson: async () => ({ values: { "Full name": "Ada", Essay: "I love maths." } }) }));

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.ensure, { ownerId: OWNER_A });
  await t.mutation(api.users.ensure, { ownerId: OWNER_B });
  const itemId = await t.run(async (ctx) => {
    const user = (await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER_A)).unique())!;
    return await ctx.db.insert("savedItems", {
      userId: user._id, sourceKind: "url", sourceUrl: "https://forms.gle/demo", sourcePlatform: "web", contentTypes: ["scholarship"], primaryType: "scholarship",
      extractionStatus: "ready", searchText: "", createdAt: 1, updatedAt: 1,
    } as never);
  });
  const runId = await t.run(async (ctx) => {
    const item = (await ctx.db.get(itemId))!;
    return await ctx.db.insert("formFillRuns", { userId: item.userId, itemId, url: "https://forms.gle/demo", status: "queued", fields: [], screenshotIds: [], createdAt: 1, updatedAt: 1 });
  });
  return { t, itemId, runId };
}

const status = (t: Awaited<ReturnType<typeof setup>>["t"], runId: never) => t.run(async (ctx) => (await ctx.db.get(runId as never) as { status: string }).status);

beforeEach(() => {
  acts.length = 0;
  wall = false;
  launchFails = false;
  closed.stagehand = closed.browser = 0;
  process.env.BROWSERBASE_API_KEY = "k";
  process.env.BROWSERBASE_PROJECT_ID = "p";
  process.env.OPENAI_API_KEY = "o";
});
afterEach(() => vi.useRealTimers());

describe("never-submit guard", () => {
  it("allows typing and selecting", () => {
    expect(() => assertSafeInstruction('Type %value% into the "Full name" field')).not.toThrow();
    expect(() => assertSafeInstruction('Select %value% in the "School" field')).not.toThrow();
  });
  it("refuses submit-like and login instructions", () => {
    for (const s of ["Click the Submit button", 'Type %value% into the "Confirm email" field', "Click Apply now", "Press send", "Pay the fee", "Type the password", "Click finish"]) {
      expect(() => assertSafeInstruction(s)).toThrow();
    }
  });
});

describe("fill state machine", () => {
  it("fills, skips sensitive fields, reaches needs_approval, then expires after the hold", async () => {
    const { t, runId } = await setup();
    expect(HOLD_MS).toBe(8 * 60 * 1000);
    await t.action(internal.formFillAgent.run, { runId, holdMs: 40, pollMs: 10 }).then(async () => {
      expect(await status(t, runId as never)).toBe("expired");
    });
    const run = await t.run(async (ctx) => (await ctx.db.get(runId))!);
    expect(run.fields.map((f) => [f.label, f.state])).toEqual([["Full name", "filled"], ["Password", "skipped"], ["Essay", "filled"]]);
    expect(run.screenshotIds.length).toBeGreaterThan(0);
    expect(run.liveViewUrl).toBe("https://live.example/x");
    expect(acts.length).toBe(2);
    expect(acts.every((a) => /^(Type|Select)/.test(a))).toBe(true);
    expect(closed).toEqual({ stagehand: 1, browser: 1 });
  });

  it("approve then cancel; a cancelled run closes the session", async () => {
    const { t, runId } = await setup();
    const running = t.action(internal.formFillAgent.run, { runId, holdMs: 5000, pollMs: 10 });
    for (let i = 0; i < 100 && (await status(t, runId as never)) !== "needs_approval"; i++) await new Promise((r) => setTimeout(r, 10));
    await t.mutation(api.formFill.approve, { ownerId: OWNER_A, runId });
    expect(await status(t, runId as never)).toBe("approved");
    await t.mutation(api.formFill.cancel, { ownerId: OWNER_A, runId });
    await running;
    expect(await status(t, runId as never)).toBe("cancelled");
    expect(closed).toEqual({ stagehand: 1, browser: 1 });
  });

  it("sets blocked on a login wall and fills nothing", async () => {
    wall = true;
    const { t, runId } = await setup();
    await t.action(internal.formFillAgent.run, { runId });
    expect(await status(t, runId as never)).toBe("blocked");
    expect(acts).toEqual([]);
    expect(closed).toEqual({ stagehand: 1, browser: 1 });
  });

  it("start schedules a run once and requires a scholarship link", async () => {
    vi.useFakeTimers();
    const { t, itemId } = await setup();
    const a = await t.mutation(api.formFill.start, { ownerId: OWNER_A, itemId });
    expect(await t.mutation(api.formFill.start, { ownerId: OWNER_A, itemId })).toBe(a);
    expect(await t.query(api.formFill.available, { ownerId: OWNER_A })).toBe(true);
    delete process.env.BROWSERBASE_API_KEY;
    expect(await t.query(api.formFill.available, { ownerId: OWNER_A })).toBe(false);
  });
});

describe("demo fallback when the browser cannot start", () => {
  const DEMO = "https://pleasant-lark-678.convex.site/demo/apply";

  it("prepares values, waits for approval, then posts to the demo form only", async () => {
    launchFails = true;
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { t, runId } = await setup();
    await t.run(async (ctx) => ctx.db.patch(runId as never, { url: DEMO }));
    const running = t.action(internal.formFillAgent.run, { runId, holdMs: 5000, pollMs: 10 });
    for (let i = 0; i < 100 && (await status(t, runId as never)) !== "needs_approval"; i++) await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
    await t.mutation(api.formFill.approve, { ownerId: OWNER_A, runId });
    await running;
    expect(await status(t, runId as never)).toBe("submitted");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown[])[0]).toBe(DEMO);
    vi.unstubAllGlobals();
  });

  it("does not fall back for other sites", async () => {
    launchFails = true;
    const { t, runId } = await setup();
    await t.action(internal.formFillAgent.run, { runId });
    expect(await status(t, runId as never)).toBe("failed");
  });
});

describe("ownership", () => {
  it("refuses another owner, bad ids and unknown devices", async () => {
    vi.useFakeTimers();
    const { t, itemId, runId } = await setup();
    await expect(t.mutation(api.formFill.start, { ownerId: OWNER_B, itemId })).rejects.toThrow();
    await expect(t.query(api.formFill.get, { ownerId: OWNER_B, runId })).rejects.toThrow();
    await expect(t.mutation(api.formFill.approve, { ownerId: OWNER_B, runId })).rejects.toThrow();
    await expect(t.mutation(api.formFill.cancel, { ownerId: OWNER_B, runId })).rejects.toThrow();
    await expect(t.query(api.formFill.latestForItem, { ownerId: OWNER_B, itemId })).rejects.toThrow();
    await expect(t.query(api.formFill.available, { ownerId: "not-a-uuid" })).rejects.toThrow();
    await expect(t.query(api.formFill.get, { ownerId: "33333333-3333-4333-8333-333333333333", runId })).rejects.toThrow();
  });
});
