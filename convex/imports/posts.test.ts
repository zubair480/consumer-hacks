// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";
import { BOOKMARKS_PAGE } from "./xClient.test";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

const post = (id: string, extra: Partial<{ text: string; url: string; author: string }> = {}) => ({
  platform: "x" as const,
  url: `https://x.com/someone/status/${id}`,
  text: `Bookmarked post ${id}`,
  author: "Someone (@someone)",
  ...extra,
});

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.ensure, { ownerId: OWNER_A });
  await t.mutation(api.users.ensure, { ownerId: OWNER_B });
  return t;
}

beforeEach(() => {
  // Scheduled ingest would call OpenAI; keep it queued.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("imports.posts.importBatch", () => {
  it("creates items with the post text filled in and schedules ingest", async () => {
    const t = await setup();
    const result = await t.mutation(api.imports.posts.importBatch, { ownerId: OWNER_A, posts: [post("1"), post("2")] });
    expect(result).toEqual({ created: 2, duplicates: 0, invalid: 0 });

    const items = await t.query(api.items.list, { ownerId: OWNER_A });
    expect(items).toHaveLength(2);
    const first = items.find((i) => i.sourceUrl === "https://x.com/someone/status/1")!;
    expect(first).toMatchObject({ sourceKind: "url", sourcePlatform: "x", extractionStatus: "pending" });
    expect(first.rawText).toBe("Post by Someone (@someone) on X\n\nBookmarked post 1");

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name)).toEqual(["ingest:run", "ingest:run"]);

    const activity = await t.query(api.activity.list, { ownerId: OWNER_A });
    expect(activity[0]).toMatchObject({ type: "item_saved", title: "Imported 2 saves from X", detail: "2 new, 0 already in Zapy" });
  });

  it("skips duplicates: re-imports, repeats in a batch, and links already saved by paste", async () => {
    const t = await setup();
    await t.mutation(api.items.create, { ownerId: OWNER_A, sourceUrl: "https://twitter.com/someone/status/3?s=46" });
    await t.mutation(api.imports.posts.importBatch, { ownerId: OWNER_A, posts: [post("1")] });

    const result = await t.mutation(api.imports.posts.importBatch, {
      ownerId: OWNER_A,
      posts: [post("1"), post("2"), post("2"), post("3"), { ...post("4"), url: "not a link" }],
    });
    expect(result).toEqual({ created: 1, duplicates: 3, invalid: 1 });
    expect(await t.query(api.items.list, { ownerId: OWNER_A })).toHaveLength(3);
  });

  it("re-imports a post whose item was deleted and reuses its ledger row", async () => {
    const t = await setup();
    await t.mutation(api.imports.posts.importBatch, { ownerId: OWNER_A, posts: [post("5")] });
    const [item] = await t.query(api.items.list, { ownerId: OWNER_A });
    await t.mutation(api.items.remove, { ownerId: OWNER_A, itemId: item._id as Id<"savedItems"> });

    const result = await t.mutation(api.imports.posts.importBatch, { ownerId: OWNER_A, posts: [post("5")] });
    expect(result).toEqual({ created: 1, duplicates: 0, invalid: 0 });
    const items = await t.query(api.items.list, { ownerId: OWNER_A });
    expect(items).toHaveLength(1);
    const ledger = await t.run((ctx) => ctx.db.query("importedPosts").collect());
    expect(ledger).toHaveLength(1);
    expect(ledger[0].itemId).toBe(items[0]._id);
  });

  it("dedupes per owner only", async () => {
    const t = await setup();
    await t.mutation(api.imports.posts.importBatch, { ownerId: OWNER_A, posts: [post("1")] });
    const result = await t.mutation(api.imports.posts.importBatch, { ownerId: OWNER_B, posts: [post("1")] });
    expect(result.created).toBe(1);
    expect(await t.query(api.items.list, { ownerId: OWNER_A })).toHaveLength(1);
    expect(await t.query(api.items.list, { ownerId: OWNER_B })).toHaveLength(1);
  });

  it("refuses an unknown or malformed ownerId and writes nothing", async () => {
    const t = await setup();
    await expect(
      t.mutation(api.imports.posts.importBatch, { ownerId: "33333333-3333-4333-8333-333333333333", posts: [post("1")] }),
    ).rejects.toThrow("Unknown owner");
    await expect(t.mutation(api.imports.posts.importBatch, { ownerId: "not-a-uuid", posts: [post("1")] })).rejects.toThrow("Invalid ownerId");
    const all = await t.run((ctx) => ctx.db.query("savedItems").collect());
    expect(all).toHaveLength(0);
  });

  it("rejects oversized batches", async () => {
    const t = await setup();
    const posts = Array.from({ length: 101 }, (_, i) => post(String(i)));
    await expect(t.mutation(api.imports.posts.importBatch, { ownerId: OWNER_A, posts })).rejects.toThrow("at most 100");
  });
});

describe("imports.connections", () => {
  async function connectX(t: Awaited<ReturnType<typeof setup>>, overrides: { expiresAt?: number; refreshToken?: string } = {}) {
    return await t.run(async (ctx) => {
      const user = (await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER_A)).unique())!;
      return await ctx.db.insert("importConnections", {
        userId: user._id,
        platform: "x",
        externalUserId: "42",
        username: "ali",
        accessToken: "at",
        refreshToken: overrides.refreshToken,
        expiresAt: overrides.expiresAt ?? Date.now() + 3_600_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  }

  it("lists X plus coming-soon sources without exposing tokens", async () => {
    vi.stubEnv("X_CLIENT_ID", "cid");
    const t = await setup();
    await connectX(t);
    const sources = await t.query(api.imports.connections.sources, { ownerId: OWNER_A });
    expect(sources.map((s) => [s.platform, s.comingSoon, s.connected])).toEqual([
      ["x", false, true],
      ["instagram", true, false],
      ["linkedin", true, false],
    ]);
    expect(JSON.stringify(sources)).not.toContain("\"at\"");
    const other = await t.query(api.imports.connections.sources, { ownerId: OWNER_B });
    expect(other[0]).toMatchObject({ connected: false, configured: true });
  });

  it("starts X OAuth with PKCE and a server-side callback", async () => {
    vi.stubEnv("X_CLIENT_ID", "cid");
    vi.stubEnv("CONVEX_SITE_URL", "https://dep.convex.site");
    const t = await setup();
    const { authorizeUrl } = await t.action(api.imports.connections.startXConnect, { ownerId: OWNER_A, returnUrl: "exp://192.168.1.2:8081/--/import" });
    const url = new URL(authorizeUrl);
    expect(url.searchParams.get("redirect_uri")).toBe("https://dep.convex.site/oauth/x/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const states = await t.run((ctx) => ctx.db.query("importOAuthStates").collect());
    expect(states).toHaveLength(1);
    expect(states[0]!.state).toBe(url.searchParams.get("state"));
    await expect(
      t.action(api.imports.connections.startXConnect, { ownerId: OWNER_A, returnUrl: "https://evil.example.com" }),
    ).rejects.toThrow("Invalid return URL");
  });

  it("explains when X credentials are missing", async () => {
    vi.stubEnv("X_CLIENT_ID", "");
    const t = await setup();
    await expect(t.action(api.imports.connections.startXConnect, { ownerId: OWNER_A, returnUrl: "zapy://import" })).rejects.toThrow("X_CLIENT_ID");
  });

  it("completes the callback, stores tokens, and redirects back to the app", async () => {
    vi.stubEnv("X_CLIENT_ID", "cid");
    vi.stubEnv("CONVEX_SITE_URL", "https://dep.convex.site");
    const t = await setup();
    const { authorizeUrl } = await t.action(api.imports.connections.startXConnect, { ownerId: OWNER_A, returnUrl: "zapy://import" });
    const state = new URL(authorizeUrl).searchParams.get("state")!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("oauth2/token")
          ? new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 7200 }))
          : new Response(JSON.stringify({ data: { id: "42", username: "ali" } })),
      ),
    );
    const res = await t.fetch(`/oauth/x/callback?state=${state}&code=abc`, { redirect: "manual" });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('href="zapy://import?x=connected"');
    expect(html).toContain("Return to Zapy");
    expect(html).toContain('window.location.replace("zapy://import?x=connected")');
    expect(html).toContain("intent://import?x=connected#Intent;scheme=zapy;end");
    const sources = await t.query(api.imports.connections.sources, { ownerId: OWNER_A });
    expect(sources[0]).toMatchObject({ connected: true, username: "ali" });

    const replay = await t.fetch(`/oauth/x/callback?state=${state}&code=abc`, { redirect: "manual" });
    expect(replay.status).toBe(400);
  });

  it("syncs bookmarks, stops paging once a page is already imported, and refreshes expired tokens", async () => {
    vi.stubEnv("X_CLIENT_ID", "cid");
    const t = await setup();
    await connectX(t, { expiresAt: Date.now() - 1000, refreshToken: "rt" });
    const fetch = vi.fn(async (url: string) => {
      if (String(url).includes("oauth2/token")) return new Response(JSON.stringify({ access_token: "fresh", refresh_token: "rt2", expires_in: 7200 }));
      return new Response(JSON.stringify(BOOKMARKS_PAGE));
    });
    vi.stubGlobal("fetch", fetch);

    const first = await t.action(api.imports.connections.syncX, { ownerId: OWNER_A });
    // Page 1 imports 3; page 2 (same fixture) is all duplicates, so paging stops.
    expect(first).toEqual({ created: 3, duplicates: 3, invalid: 0 });
    const bookmarkCalls = fetch.mock.calls.filter(([u]) => String(u).includes("/bookmarks"));
    expect(bookmarkCalls).toHaveLength(2);
    expect(new URL(String(bookmarkCalls[1]![0])).searchParams.get("pagination_token")).toBe("next-1");

    const second = await t.action(api.imports.connections.syncX, { ownerId: OWNER_A });
    expect(second).toEqual({ created: 0, duplicates: 3, invalid: 0 });
    const conn = await t.run((ctx) => ctx.db.query("importConnections").unique());
    expect(conn).toMatchObject({ accessToken: "fresh", refreshToken: "rt2", lastSyncNew: 0, lastSyncSkipped: 3 });

    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name).sort()).toEqual(["imports/posts:attachImageThenIngest", "imports/posts:attachImageThenIngest", "ingest:run"]);
  });

  it("shows X's real error instead of 'no saved posts' when bookmarks are refused", async () => {
    vi.stubEnv("X_CLIENT_ID", "cid");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const t = await setup();
    await connectX(t);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ title: "Forbidden", detail: "Missing bookmark access." }), { status: 403 })));
    await expect(t.action(api.imports.connections.syncX, { ownerId: OWNER_A })).rejects.toThrow("Forbidden: Missing bookmark access.");
    const conn = await t.run((ctx) => ctx.db.query("importConnections").unique());
    expect(conn?.lastError).toContain("Missing bookmark access.");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ meta: { result_count: 0 } }))));
    expect(await t.action(api.imports.connections.syncX, { ownerId: OWNER_A })).toEqual({ created: 0, duplicates: 0, invalid: 0 });
  });

  it("refuses to sync for another owner", async () => {
    vi.stubEnv("X_CLIENT_ID", "cid");
    const t = await setup();
    await connectX(t);
    await expect(t.action(api.imports.connections.syncX, { ownerId: OWNER_B })).rejects.toThrow("Connect X first");
    await expect(t.action(api.imports.connections.syncX, { ownerId: "33333333-3333-4333-8333-333333333333" })).rejects.toThrow("Unknown owner");
  });
});
