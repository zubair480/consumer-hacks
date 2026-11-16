// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_EVENT_TEXT, DEMO_REPO_URL, SUMMIT_TEXT, applyFormHtml, demoFormUrl, eventTiming, summitPostHtml } from "./lib/demo";
import { fetchWebPage } from "./lib/sources";

const OWNER = "33333333-3333-4333-8333-333333333333";
const SITE = "https://pleasant-lark-678.convex.site";
const ORDER = [DEMO_REPO_URL, `${SITE}/demo/apply?program=sunny-camp`, `${SITE}/demo/apply?program=brightpath`, `${SITE}/demo/post/nurses-summit`];

const ownerItems = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("savedItems").collect());

async function analyze(t: ReturnType<typeof convexTest>, itemId: string, primaryType: "general_content" | "event", facts: { key: string; label: string; value: string; quote: string }[] = []) {
  await t.mutation(internal.analysis.save, {
    itemId: itemId as never,
    extractionStatus: "needs_input",
    extractionError: "That page didn't have readable text",
    sourceAccessible: false,
    missingInfo: [],
    contentTypes: [primaryType],
    primaryType,
    title: "Something",
    summary: "Something saved",
    facts: facts.map((f) => ({ key: f.key, label: f.label, value: f.value, evidence: { quote: f.quote, source: "user_text" }, confidence: 0.9 })),
  });
}

describe("demo.pullEverything (v2)", () => {
  it("seeds the 4 demo saves oldest to newest, once per owner, and removes v1 demo saves", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.users.ensure, { ownerId: OWNER });
    await t.run(async (ctx) => {
      const user = (await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER)).unique())!;
      const base = { userId: user._id, contentTypes: [], extractionStatus: "ready" as const, searchText: "", createdAt: 1, updatedAt: 1 };
      await ctx.db.insert("savedItems", { ...base, sourceKind: "url", sourceUrl: DEMO_REPO_URL, sourcePlatform: "github" });
      await ctx.db.insert("savedItems", { ...base, sourceKind: "url", sourceUrl: demoFormUrl(SITE), sourcePlatform: "web" });
      await ctx.db.insert("savedItems", { ...base, sourceKind: "text", rawText: DEMO_EVENT_TEXT, sourcePlatform: "manual" });
      await ctx.db.insert("savedItems", { ...base, sourceKind: "url", sourceUrl: "https://example.com/keep-me", sourcePlatform: "web" });
    });

    expect(await t.mutation(api.demo.pullEverything, { ownerId: OWNER })).toEqual({ created: 4, xSync: false });
    expect((await t.mutation(api.demo.pullEverything, { ownerId: OWNER })).created).toBe(0);

    const items = await ownerItems(t);
    expect(items.map((i) => i.sourceUrl ?? i.rawText).sort()).toEqual([...ORDER, "https://example.com/keep-me"].sort());
    const demo = items.filter((i) => i.demoKey).sort((a, b) => a.createdAt - b.createdAt);
    expect(demo.map((i) => i.sourceUrl)).toEqual(ORDER);
    expect(demo.map((i) => i.demoKey)).toEqual(["v2:repo", "v2:camp", "v2:scholarship", "v2:summit"]);
    expect(demo.every((i) => (i.rawText ?? "").length > 40)).toBe(true);
  });

  it("forces each demo save to Ready with its type, so the right primary action leads", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.pullEverything, { ownerId: OWNER });
    const demo = (await ownerItems(t)).sort((a, b) => a.createdAt - b.createdAt);
    for (const item of demo) await analyze(t, item._id, "general_content");
    const actions = [];
    for (const item of demo) actions.push(await t.query(api.demo.primaryAction, { ownerId: OWNER, itemId: item._id }));
    expect(actions.map((a) => a.action?.label)).toEqual(["Run it for me", "Fill it for me", "Fill it for me", "Add to my calendar"]);
    const after = await ownerItems(t);
    expect(after.every((i) => i.extractionStatus === "ready")).toBe(true);
    const status = await t.query(api.demo.pullStatus, { ownerId: OWNER });
    expect(status).toEqual({ total: 4, analyzed: 4, done: true, byBox: { code: 1, forms: 2, events: 1, jobs: 0, learn: 0, other: 0 } });
    vi.useRealTimers();
  });

  it("re-seeds and re-queues a stuck demo save", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.pullEverything, { ownerId: OWNER });
    const camp = (await ownerItems(t)).find((i) => i.demoKey === "v2:camp")!;
    await t.run((ctx) => ctx.db.patch(camp._id, { rawText: undefined, extractionStatus: "needs_input", extractionError: "x" }));
    await t.mutation(api.demo.pullEverything, { ownerId: OWNER });
    const again = (await ownerItems(t)).find((i) => i.demoKey === "v2:camp")!;
    expect(again.extractionStatus).toBe("pending");
    expect(again.rawText).toContain("Sunny Days");
  });
});

describe("summit calendar proposal", () => {
  it("extracts Dec 10 2026 09:00 for 8 hours, not the early-bird deadline", () => {
    const facts = ["Friday, November 20 at 11:59 PM Early bird ends Friday, November 20 at 11:59 PM", "Thursday, December 10, 2026 Thursday, December 10, 2026, 9:00 AM–5:00 PM"];
    expect(eventTiming([SUMMIT_TEXT, ...facts], "2026-11-20", Date.UTC(2026, 10, 15))).toEqual({ startDateTime: "2026-12-10T09:00:00", durationMinutes: 480 });
    expect(eventTiming([...facts], "2026-11-20", Date.UTC(2026, 10, 15))).toEqual({ startDateTime: "2026-12-10T09:00:00", durationMinutes: 480 });
  });

  it("calendar.prepare builds the proposal from the summit save", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.pullEverything, { ownerId: OWNER });
    const summit = (await ownerItems(t)).find((i) => i.demoKey === "v2:summit")!;
    await analyze(t, summit._id, "event", [{ key: "early_bird_deadline", label: "Early bird ends", value: "Friday, November 20 at 11:59 PM", quote: "early bird ends Friday, November 20 at 11:59 PM" }]);
    await t.run((ctx) => ctx.db.patch(summit._id, { location: "Oakland Marriott City Center", deadline: "2026-11-20" }));
    const jobId = await t.mutation(api.agents.calendar.prepare, { ownerId: OWNER, itemId: summit._id });
    const job = await t.run((ctx) => ctx.db.get(jobId));
    expect(job!.proposal).toMatchObject({ startDateTime: "2026-12-10T09:00:00", durationMinutes: 480, timezone: "America/Los_Angeles", location: "Oakland Marriott City Center" });
  });
});

describe("demo pages over HTTP", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("serves each program variant, stores the program, and lists it", async () => {
    const t = convexTest(schema, modules);
    const camp = await (await t.fetch("/demo/apply?program=sunny-camp", { method: "GET" })).text();
    expect(camp).toContain("Sunny Days Free Summer Camp");
    expect(camp).toContain("Parent or guardian name");
    expect(camp).toContain("How did you hear about us?");
    expect(await (await t.fetch("/demo/apply?program=brightpath", { method: "GET" })).text()).toContain("Brightpath First-Gen STEM Scholarship: $10,000");
    expect(await (await t.fetch("/demo/apply?program=summit", { method: "GET" })).text()).toContain("Night Shift Nurses Summit 2026 · Early-bird registration");
    const post = await t.fetch("/demo/apply", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "program=sunny-camp&name=Ada+Lovelace&email=ada%40example.com&phone=555-0100&heard=Saw+your+post+and+saved+it+with+Zapy",
    });
    expect(await post.text()).toContain("Thanks, Ada Lovelace!");
    const list = await (await t.fetch("/demo/submissions", { method: "GET" })).text();
    expect(list).toContain("sunny-camp");
    expect(list).toContain("Saw your post and saved it with Zapy");
    expect(await (await t.fetch("/demo/post/nurses-summit", { method: "GET" })).text()).toContain("Zapy demo page");
  });

  it("every demo page passes the extractor", async () => {
    for (const page of [applyFormHtml(), applyFormHtml("sunny-camp"), applyFormHtml("brightpath"), applyFormHtml("summit"), summitPostHtml()]) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response(page, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })));
      const fetched = await fetchWebPage(`${SITE}/demo/page`);
      expect(fetched.ok).toBe(true);
    }
    vi.stubGlobal("fetch", vi.fn(async () => new Response(summitPostHtml(), { status: 200, headers: { "Content-Type": "text/html" } })));
    const summit = await fetchWebPage(`${SITE}/demo/post/nurses-summit`);
    expect(summit.ok && summit.part.text).toContain("December 10, 2026, 9:00 AM–5:00 PM");
  });
});
