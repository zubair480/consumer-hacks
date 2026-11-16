// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { DEMO_EVENT_TEXT, DEMO_FORM_TEXT, DEMO_REPO_URL, applyFormHtml } from "./lib/demo";
import { fetchWebPage } from "./lib/sources";

const OWNER = "33333333-3333-4333-8333-333333333333";

describe("demo.pullEverything", () => {
  it("seeds the 3 demo saves once per owner and reports pull status", async () => {
    const t = convexTest(schema, modules);
    const first = await t.mutation(api.demo.pullEverything, { ownerId: OWNER });
    expect(first).toEqual({ created: 3, xSync: false });
    const again = await t.mutation(api.demo.pullEverything, { ownerId: OWNER });
    expect(again.created).toBe(0);
    const items = await t.run((ctx) => ctx.db.query("savedItems").collect());
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.sourceUrl ?? i.rawText).sort()).toEqual([DEMO_EVENT_TEXT, DEMO_REPO_URL, "https://pleasant-lark-678.convex.site/demo/apply"].sort());

    const pending = await t.query(api.demo.pullStatus, { ownerId: OWNER });
    expect(pending).toEqual({ total: 3, analyzed: 0, done: false, byBox: { code: 0, forms: 0, events: 0, jobs: 0, learn: 0, other: 0 } });

    await t.run(async (ctx) => {
      const types = { [DEMO_REPO_URL]: "github_repository", [DEMO_EVENT_TEXT]: "event" } as const;
      for (const i of items) {
        const type = types[(i.sourceUrl ?? i.rawText) as keyof typeof types] ?? "application";
        await ctx.db.patch(i._id, { extractionStatus: "ready", primaryType: type, contentTypes: [type] });
      }
    });
    const done = await t.query(api.demo.pullStatus, { ownerId: OWNER });
    expect(done).toEqual({ total: 3, analyzed: 3, done: true, byBox: { code: 1, forms: 1, events: 1, jobs: 0, learn: 0, other: 0 } });
  });
});

describe("demo form over HTTP", () => {
  it("serves the form, stores a submission, and lists it", async () => {
    const t = convexTest(schema, modules);
    const form = await t.fetch("/demo/apply", { method: "GET" });
    const page = await form.text();
    for (const name of ["name", "email", "phone", "studying"]) expect(page).toContain(`name="${name}"`);
    const post = await t.fetch("/demo/apply", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=Ada+Lovelace&email=ada%40example.com&phone=555-0100&studying=Math",
    });
    expect(await post.text()).toContain("Thanks, Ada Lovelace! Your application was received.");
    const list = await (await t.fetch("/demo/submissions", { method: "GET" })).text();
    expect(list).toContain("ada@example.com");
  });
});

describe("demo application save", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("serves enough readable text for the extractor", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(applyFormHtml(), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } })));
    const fetched = await fetchWebPage("https://pleasant-lark-678.convex.site/demo/apply");
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    for (const phrase of ["Zapy Demo Program", "Eligibility", "December 15, 2026", "Phone number", "What are you studying?"]) expect(fetched.part.text).toContain(phrase);
  });

  it("is seeded with readable text, and a stuck one is re-seeded and re-analyzed", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.demo.pullEverything, { ownerId: OWNER });
    const form = async () => (await t.run((ctx) => ctx.db.query("savedItems").collect())).find((i) => i.sourceUrl?.endsWith("/demo/apply"))!;
    expect((await form()).rawText).toBe(DEMO_FORM_TEXT);

    const stuck = await form();
    await t.run((ctx) => ctx.db.patch(stuck._id, { rawText: undefined, extractionStatus: "needs_input", extractionError: "That page didn't have readable text" }));
    expect((await t.mutation(api.demo.pullEverything, { ownerId: OWNER })).created).toBe(0);
    const reseeded = await form();
    expect(reseeded.rawText).toBe(DEMO_FORM_TEXT);
    expect(reseeded.extractionStatus).toBe("pending");
    expect(reseeded.extractionError).toBeUndefined();
  });
});
