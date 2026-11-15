// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { likedPage, videoIds } from "./youtubeClient.test";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";
const RETURN = "exp://192.168.1.2:8081/--/import";

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.ensure, { ownerId: OWNER_A });
  await t.mutation(api.users.ensure, { ownerId: OWNER_B });
  return t;
}
type T = Awaited<ReturnType<typeof setup>>;

function configure() {
  vi.stubEnv("GOOGLE_CLIENT_ID", "cid");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("CONVEX_SITE_URL", "https://dep.convex.site");
}

async function connect(t: T, overrides: { expiresAt?: number; refreshToken?: string } = {}) {
  return await t.run(async (ctx) => {
    const user = (await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER_A)).unique())!;
    return await ctx.db.insert("importConnections", {
      userId: user._id,
      platform: "youtube",
      externalUserId: "UC1",
      username: "Ali",
      accessToken: "at",
      refreshToken: overrides.refreshToken,
      expiresAt: overrides.expiresAt ?? Date.now() + 3_600_000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

/** Serves liked-videos pages in order and token refreshes. */
function stubGoogle(pages: ReturnType<typeof likedPage>[]) {
  const queue = [...pages];
  const fetch = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "fresh", expires_in: 3600 }));
    if (u.includes("/youtube/v3/channels")) return new Response(JSON.stringify({ items: [{ id: "UC1", snippet: { title: "Ali" } }] }));
    if (u.includes("/youtube/v3/videos")) return new Response(JSON.stringify(queue.shift() ?? { items: [] }));
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("imports.youtube connect", () => {
  it("reports not configured and refuses to start without Google credentials", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    const t = await setup();
    expect(await t.query(api.imports.youtube.status, { ownerId: OWNER_A })).toMatchObject({ configured: false, connected: false });
    await expect(t.action(api.imports.youtube.startConnect, { ownerId: OWNER_A, returnUrl: RETURN })).rejects.toThrow("GOOGLE_CLIENT_ID");
  });

  it("starts OAuth with a server-side state and rejects foreign return URLs", async () => {
    configure();
    const t = await setup();
    const { authorizeUrl } = await t.action(api.imports.youtube.startConnect, { ownerId: OWNER_A, returnUrl: RETURN });
    const url = new URL(authorizeUrl);
    expect(url.searchParams.get("redirect_uri")).toBe("https://dep.convex.site/oauth/google/callback");
    expect(url.searchParams.get("access_type")).toBe("offline");
    const states = await t.run((ctx) => ctx.db.query("importOAuthStates").collect());
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ platform: "youtube", state: url.searchParams.get("state"), returnUrl: RETURN });
    await expect(t.action(api.imports.youtube.startConnect, { ownerId: OWNER_A, returnUrl: "https://evil.example.com" })).rejects.toThrow("Invalid return URL");
    await expect(t.action(api.imports.youtube.startConnect, { ownerId: "33333333-3333-4333-8333-333333333333", returnUrl: RETURN })).rejects.toThrow("Unknown owner");
  });

  it("completes the callback, stores tokens server-side, redirects to /import, and refuses a replay", async () => {
    configure();
    const t = await setup();
    const { authorizeUrl } = await t.action(api.imports.youtube.startConnect, { ownerId: OWNER_A, returnUrl: RETURN });
    const state = new URL(authorizeUrl).searchParams.get("state")!;
    const fetch = vi.fn(async (url: string) =>
      String(url).includes("oauth2.googleapis.com/token")
        ? new Response(JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600 }))
        : new Response(JSON.stringify({ items: [{ id: "UC1", snippet: { title: "Ali" } }] })),
    );
    vi.stubGlobal("fetch", fetch);

    const res = await t.fetch(`/oauth/google/callback?state=${state}&code=abc`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`${RETURN}?youtube=connected`);
    const conn = await t.run((ctx) => ctx.db.query("importConnections").unique());
    expect(conn).toMatchObject({ platform: "youtube", externalUserId: "UC1", username: "Ali", accessToken: "at", refreshToken: "rt" });
    const status = await t.query(api.imports.youtube.status, { ownerId: OWNER_A });
    expect(status).toMatchObject({ configured: true, connected: true, channelTitle: "Ali" });
    expect(JSON.stringify(status)).not.toContain("\"at\"");
    expect(await t.query(api.imports.youtube.status, { ownerId: OWNER_B })).toMatchObject({ connected: false });

    const replay = await t.fetch(`/oauth/google/callback?state=${state}&code=abc`, { redirect: "manual" });
    expect(replay.status).toBe(400);
    const unknown = await t.fetch("/oauth/google/callback?state=nope&code=abc", { redirect: "manual" });
    expect(unknown.status).toBe(400);
    const missing = await t.fetch("/oauth/google/callback?code=abc", { redirect: "manual" });
    expect(missing.status).toBe(400);
    expect(fetch.mock.calls.filter(([u]) => String(u).includes("/token"))).toHaveLength(1);
  });

  it("does not accept an X state at the Google callback", async () => {
    configure();
    vi.stubEnv("X_CLIENT_ID", "xid");
    const t = await setup();
    const { authorizeUrl } = await t.action(api.imports.connections.startXConnect, { ownerId: OWNER_A, returnUrl: RETURN });
    const state = new URL(authorizeUrl).searchParams.get("state")!;
    const res = await t.fetch(`/oauth/google/callback?state=${state}&code=abc`, { redirect: "manual" });
    expect(res.status).toBe(400);
    expect(await t.run((ctx) => ctx.db.query("importOAuthStates").collect())).toHaveLength(1);
  });

  it("sends a denied consent back to the app as an error", async () => {
    configure();
    const t = await setup();
    const { authorizeUrl } = await t.action(api.imports.youtube.startConnect, { ownerId: OWNER_A, returnUrl: RETURN });
    const state = new URL(authorizeUrl).searchParams.get("state")!;
    const res = await t.fetch(`/oauth/google/callback?state=${state}&error=access_denied`, { redirect: "manual" });
    const back = new URL(res.headers.get("Location")!);
    expect(back.searchParams.get("youtube")).toBe("error");
    expect(back.searchParams.get("message")).toContain("cancelled");
  });
});

describe("imports.youtube.sync", () => {
  it("imports liked videos with text and thumbnail, refreshing an expired token and keeping the refresh token", async () => {
    configure();
    const t = await setup();
    await connect(t, { expiresAt: Date.now() - 1000, refreshToken: "rt" });
    const ids = videoIds(3);
    const fetch = stubGoogle([likedPage(ids)]);

    expect(await t.action(api.imports.youtube.sync, { ownerId: OWNER_A })).toEqual({ created: 3, duplicates: 0, invalid: 0 });
    const conn = await t.run((ctx) => ctx.db.query("importConnections").unique());
    expect(conn).toMatchObject({ accessToken: "fresh", refreshToken: "rt", lastSyncNew: 3 });
    const videoCall = fetch.mock.calls.find(([u]) => String(u).includes("/videos"))!;
    expect(new URL(String(videoCall[0])).searchParams.get("maxResults")).toBe("20");

    const items = await t.query(api.items.list, { ownerId: OWNER_A });
    const item = items.find((i) => i.sourceUrl === `https://www.youtube.com/watch?v=${ids[0]}`)!;
    expect(item).toMatchObject({ sourcePlatform: "youtube", extractionStatus: "pending" });
    expect(item.rawText).toBe(`Post by Some Channel on YouTube\n\nVideo ${ids[0]}\n\nChannel: Some Channel\n\nDescription of ${ids[0]}`);
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name)).toEqual(Array(3).fill("imports/posts:attachImageThenIngest"));
    const activity = await t.query(api.activity.list, { ownerId: OWNER_A });
    expect(activity[0]).toMatchObject({ title: "Imported 3 saves from YouTube" });
  });

  it("caps a sync at 20 new items", async () => {
    configure();
    const t = await setup();
    await connect(t);
    const ids = videoIds(45);
    stubGoogle([likedPage(ids.slice(0, 20), "p2"), likedPage(ids.slice(20, 40), "p3"), likedPage(ids.slice(40))]);
    expect(await t.action(api.imports.youtube.sync, { ownerId: OWNER_A })).toEqual({ created: 20, duplicates: 0, invalid: 0 });
    expect(await t.query(api.items.list, { ownerId: OWNER_A })).toHaveLength(20);
  });

  it("dedupes by video id across syncs and against links pasted earlier, and fills the cap from the next page", async () => {
    configure();
    const t = await setup();
    await connect(t);
    const ids = videoIds(25);
    await t.mutation(api.items.create, { ownerId: OWNER_A, sourceUrl: `https://youtu.be/${ids[1]}?si=abc` });
    await t.mutation(api.items.create, { ownerId: OWNER_A, sourceUrl: "https://www.youtube.com/watch?v=someotherid" });
    stubGoogle([likedPage(ids.slice(0, 2))]);
    expect(await t.action(api.imports.youtube.sync, { ownerId: OWNER_A })).toEqual({ created: 1, duplicates: 1, invalid: 0 });

    // Page 1 has 2 known + 18 new, page 2 supplies the last 2 under the cap.
    stubGoogle([likedPage(ids.slice(0, 20), "p2"), likedPage(ids.slice(20))]);
    expect(await t.action(api.imports.youtube.sync, { ownerId: OWNER_A })).toEqual({ created: 20, duplicates: 2, invalid: 0 });

    const fetch = stubGoogle([likedPage(ids.slice(0, 20), "p2")]);
    expect(await t.action(api.imports.youtube.sync, { ownerId: OWNER_A })).toEqual({ created: 0, duplicates: 20, invalid: 0 });
    expect(fetch.mock.calls.filter(([u]) => String(u).includes("/videos"))).toHaveLength(1);
    expect(await t.query(api.items.list, { ownerId: OWNER_A })).toHaveLength(23);
  });

  it("records an error when the refresh token is revoked", async () => {
    configure();
    const t = await setup();
    await connect(t, { expiresAt: Date.now() - 1000, refreshToken: "rt" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })));
    await expect(t.action(api.imports.youtube.sync, { ownerId: OWNER_A })).rejects.toThrow("Reconnect YouTube");
    expect(await t.query(api.imports.youtube.status, { ownerId: OWNER_A })).toMatchObject({ lastError: expect.stringContaining("Reconnect YouTube") });
  });

  it("refuses to sync or disconnect for another owner", async () => {
    configure();
    const t = await setup();
    await connect(t);
    await expect(t.action(api.imports.youtube.sync, { ownerId: OWNER_B })).rejects.toThrow("Connect YouTube first");
    await expect(t.action(api.imports.youtube.sync, { ownerId: "33333333-3333-4333-8333-333333333333" })).rejects.toThrow("Unknown owner");
    await expect(t.action(api.imports.youtube.sync, { ownerId: "not-a-uuid" })).rejects.toThrow("Invalid ownerId");
    await t.mutation(api.imports.connections.disconnect, { ownerId: OWNER_B, platform: "youtube" });
    expect(await t.query(api.imports.youtube.status, { ownerId: OWNER_A })).toMatchObject({ connected: true });
    await t.mutation(api.imports.connections.disconnect, { ownerId: OWNER_A, platform: "youtube" });
    expect(await t.query(api.imports.youtube.status, { ownerId: OWNER_A })).toMatchObject({ connected: false });
  });
});
