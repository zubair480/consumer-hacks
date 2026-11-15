// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { MAX_NEW_PER_SYNC } from "./github";
import { STARS_PER_PAGE } from "./githubClient";
import { json, starredRepo } from "./githubClient.test";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.ensure, { ownerId: OWNER_A });
  await t.mutation(api.users.ensure, { ownerId: OWNER_B });
  return t;
}

/** Serves `total` stars, newest (highest id) first, paged like GitHub. */
function mockStars(total: number) {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) => {
    const page = Number(new URL(url).searchParams.get("page"));
    const ids = Array.from({ length: total }, (_, i) => total - i).slice((page - 1) * STARS_PER_PAGE, page * STARS_PER_PAGE);
    return json(ids.map((id) => starredRepo(id)));
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

describe("imports.github.sync", () => {
  it("imports stars as github items, saves the username, and caps a sync at 20 new", async () => {
    const t = await setup();
    mockStars(45);
    const first = await t.action(api.imports.github.sync, { ownerId: OWNER_A, username: "@octocat" });
    expect(first).toEqual({ created: MAX_NEW_PER_SYNC, duplicates: 0, invalid: 0 });

    const items = await t.query(api.items.list, { ownerId: OWNER_A });
    expect(items).toHaveLength(20);
    const newest = items.find((i) => i.sourceUrl === "https://github.com/octo/repo-45")!;
    expect(newest).toMatchObject({ sourceKind: "url", sourcePlatform: "github", extractionStatus: "pending" });
    expect(newest.rawText).toContain("Starred GitHub repository: octo/repo-45");
    expect(items.some((i) => i.sourceUrl === "https://github.com/octo/repo-25")).toBe(false);

    expect(await t.query(api.imports.github.status, { ownerId: OWNER_A })).toMatchObject({ username: "octocat", lastSyncNew: 20, lastError: null });
    const activity = await t.query(api.activity.list, { ownerId: OWNER_A });
    expect(activity[0]).toMatchObject({ title: "Imported 20 saves from GitHub stars" });
  });

  it("dedupes on re-sync by repo id and reuses the saved username", async () => {
    const t = await setup();
    mockStars(25);
    await t.action(api.imports.github.sync, { ownerId: OWNER_A, username: "octocat" });

    const second = await t.action(api.imports.github.sync, { ownerId: OWNER_A });
    expect(second).toEqual({ created: 5, duplicates: 20, invalid: 0 });
    const third = await t.action(api.imports.github.sync, { ownerId: OWNER_A });
    expect(third).toEqual({ created: 0, duplicates: 25, invalid: 0 });

    expect(await t.query(api.items.list, { ownerId: OWNER_A })).toHaveLength(25);
    const imported = await t.run((ctx) => ctx.db.query("importedPosts").collect());
    expect(new Set(imported.map((p) => p.externalId)).size).toBe(25);
    expect(imported.every((p) => p.platform === "github")).toBe(true);
  });

  it("stops paging once a whole page is already imported", async () => {
    const t = await setup();
    const fetch = mockStars(2 * STARS_PER_PAGE);
    await t.run(async (ctx) => {
      const user = (await ctx.db.query("users").first())!;
      for (let id = 1; id <= 2 * STARS_PER_PAGE; id++) {
        const itemId = await ctx.db.insert("savedItems", { userId: user._id, sourceKind: "url", sourceUrl: `https://github.com/octo/repo-${id}`, sourcePlatform: "github", contentTypes: [], extractionStatus: "ready", searchText: "", createdAt: 0, updatedAt: 0 });
        await ctx.db.insert("importedPosts", { userId: user._id, platform: "github", externalId: String(id), itemId, importedAt: 0 });
      }
    });
    expect(await t.action(api.imports.github.sync, { ownerId: OWNER_A, username: "octocat" })).toEqual({ created: 0, duplicates: STARS_PER_PAGE, invalid: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports a username GitHub doesn't know and does not save it", async () => {
    const t = await setup();
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "Not Found" }, 404)));
    await expect(t.action(api.imports.github.sync, { ownerId: OWNER_A, username: "ghost-user" })).rejects.toThrow('GitHub user "ghost-user" doesn\'t exist.');
    expect(await t.query(api.imports.github.status, { ownerId: OWNER_A })).toBeNull();
    expect(await t.query(api.items.list, { ownerId: OWNER_A })).toHaveLength(0);
  });

  it("records rate limits on the saved account", async () => {
    const t = await setup();
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 429, { "retry-after": "60" })));
    await expect(t.action(api.imports.github.sync, { ownerId: OWNER_A, username: "octocat" })).rejects.toThrow("rate-limiting");
    expect(await t.query(api.imports.github.status, { ownerId: OWNER_A })).toMatchObject({ username: "octocat", lastError: expect.stringContaining("rate-limiting") });
  });

  it("rejects invalid usernames and a missing username without calling GitHub", async () => {
    const t = await setup();
    const fetch = mockStars(1);
    await expect(t.action(api.imports.github.sync, { ownerId: OWNER_A })).rejects.toThrow("Enter your GitHub username first.");
    await expect(t.action(api.imports.github.sync, { ownerId: OWNER_A, username: "not a name" })).rejects.toThrow("isn't a valid GitHub username");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a wrong ownerId and keeps each owner's username separate", async () => {
    const t = await setup();
    const fetch = mockStars(3);
    await expect(t.action(api.imports.github.sync, { ownerId: "33333333-3333-4333-8333-333333333333", username: "octocat" })).rejects.toThrow("Unknown owner");
    await expect(t.action(api.imports.github.sync, { ownerId: "not-a-uuid", username: "octocat" })).rejects.toThrow("Invalid ownerId");
    expect(fetch).not.toHaveBeenCalled();

    await t.action(api.imports.github.sync, { ownerId: OWNER_A, username: "octocat" });
    expect(await t.query(api.imports.github.status, { ownerId: OWNER_B })).toBeNull();
    await expect(t.action(api.imports.github.sync, { ownerId: OWNER_B })).rejects.toThrow("Enter your GitHub username first.");
    expect(await t.query(api.items.list, { ownerId: OWNER_B })).toHaveLength(0);
  });
});
