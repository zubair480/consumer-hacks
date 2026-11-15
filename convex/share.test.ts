// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

async function setup() {
  const t = registerComponents(convexTest(schema, modules));
  await t.mutation(api.users.ensure, { ownerId: OWNER_A });
  await t.mutation(api.users.ensure, { ownerId: OWNER_B });
  const token = await t.mutation(api.share.getOrCreateShareToken, { ownerId: OWNER_A });
  return { t, token };
}

const post = (t: ReturnType<typeof convexTest>, token: string | null, body: BodyInit, contentType = "application/json") =>
  t.fetch("/save", {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": contentType },
    body,
  });

beforeEach(() => {
  // Scheduled ingest would call OpenAI; keep it queued.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("share tokens", () => {
  it("returns a stable long random token per owner", async () => {
    const { t, token } = await setup();
    expect(token).toMatch(/^zapy_[0-9a-f]{64}$/);
    expect(await t.mutation(api.share.getOrCreateShareToken, { ownerId: OWNER_A })).toBe(token);
    expect(await t.mutation(api.share.getOrCreateShareToken, { ownerId: OWNER_B })).not.toBe(token);
  });

  it("refuses a malformed or unknown ownerId", async () => {
    const { t } = await setup();
    for (const ownerId of ["not-a-uuid", "33333333-3333-4333-8333-333333333333"]) {
      await expect(t.mutation(api.share.getOrCreateShareToken, { ownerId })).rejects.toThrow();
      await expect(t.mutation(api.share.rotateShareToken, { ownerId })).rejects.toThrow();
    }
  });

  it("rotation invalidates the old token", async () => {
    const { t, token } = await setup();
    const fresh = await t.mutation(api.share.rotateShareToken, { ownerId: OWNER_A });
    expect(fresh).not.toBe(token);
    expect((await post(t, token, JSON.stringify({ text: "hi" }))).status).toBe(401);
    expect((await post(t, fresh, JSON.stringify({ text: "hi" }))).status).toBe(200);
  });
});

describe("POST /save", () => {
  it("rejects a missing or unknown token with 401 and saves nothing", async () => {
    const { t } = await setup();
    expect((await post(t, null, JSON.stringify({ text: "hi" }))).status).toBe(401);
    expect((await post(t, "zapy_nope", JSON.stringify({ text: "hi" }))).status).toBe(401);
    expect(await t.query(api.items.list, { ownerId: OWNER_A })).toHaveLength(0);
  });

  it("saves a JSON url like items.create and schedules ingest", async () => {
    const { t, token } = await setup();
    const res = await post(t, token, JSON.stringify({ url: "https://www.instagram.com/p/abc123/", text: "great recipe" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const item = await t.query(api.items.get, { ownerId: OWNER_A, itemId: body.itemId });
    expect(item).toMatchObject({
      sourceKind: "url",
      sourceUrl: "https://www.instagram.com/p/abc123/",
      sourcePlatform: "instagram",
      rawText: "great recipe",
      extractionStatus: "pending",
    });
    const scheduled = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((s) => s.name)).toEqual(["ingest:run"]);
    const activity = await t.query(api.activity.list, { ownerId: OWNER_A });
    expect(activity[0]).toMatchObject({ type: "item_saved", title: "Saved", itemId: body.itemId });
    expect(await t.query(api.items.list, { ownerId: OWNER_B })).toHaveLength(0);
  });

  it("saves text, as JSON or text/plain, and treats a lone link in text as a url", async () => {
    const { t, token } = await setup();
    const a = await (await post(t, token, JSON.stringify({ text: "Remember to apply by Friday" }))).json();
    const b = await (await post(t, token, "Plain shared note", "text/plain")).json();
    const c = await (await post(t, token, JSON.stringify({ text: "https://www.tiktok.com/@chef/video/1" }))).json();
    expect(await t.query(api.items.get, { ownerId: OWNER_A, itemId: a.itemId })).toMatchObject({ sourceKind: "text", sourcePlatform: "manual", rawText: "Remember to apply by Friday" });
    expect(await t.query(api.items.get, { ownerId: OWNER_A, itemId: b.itemId })).toMatchObject({ sourceKind: "text", rawText: "Plain shared note" });
    expect(await t.query(api.items.get, { ownerId: OWNER_A, itemId: c.itemId })).toMatchObject({ sourceKind: "url", sourcePlatform: "tiktok" });
  });

  it("rejects empty or invalid bodies with 400", async () => {
    const { t, token } = await setup();
    expect((await post(t, token, JSON.stringify({}))).status).toBe(400);
    expect((await post(t, token, "{not json")).status).toBe(400);
    expect((await post(t, token, JSON.stringify({ url: "not a link" }))).status).toBe(400);
    expect((await post(t, token, "x", "application/pdf")).status).toBe(415);
  });

  it("stores an image body and saves it as an image item", async () => {
    const { t, token } = await setup();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const res = await post(t, token, bytes, "image/png");
    expect(res.status).toBe(200);
    const { itemId } = await res.json();
    const item = await t.query(api.items.get, { ownerId: OWNER_A, itemId });
    expect(item).toMatchObject({ sourceKind: "image", sourcePlatform: "manual", extractionStatus: "pending" });
    expect(item.imageStorageId).toBeDefined();
    const stored = await t.run((ctx) => ctx.db.system.get("_storage", item.imageStorageId as Id<"_storage">));
    expect(stored).toMatchObject({ size: bytes.length, contentType: "image/png" });
  });

  it("rejects images over 8 MB with 413 and stores nothing", async () => {
    const { t, token } = await setup();
    const res = await post(t, token, new Uint8Array(8 * 1024 * 1024 + 1), "image/jpeg");
    expect(res.status).toBe(413);
    expect(await t.query(api.items.list, { ownerId: OWNER_A })).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toHaveLength(0);
  });

  it("rate-limits to 30 saves per minute per token", async () => {
    const { t, token } = await setup();
    for (let i = 0; i < 30; i++) expect((await post(t, token, JSON.stringify({ text: `note ${i}` }))).status).toBe(200);
    const limited = await post(t, token, JSON.stringify({ text: "one too many" }));
    expect(limited.status).toBe(429);
    const other = await t.mutation(api.share.getOrCreateShareToken, { ownerId: OWNER_B });
    expect((await post(t, other, JSON.stringify({ text: "other user" }))).status).toBe(200);
    vi.advanceTimersByTime(61_000);
    expect((await post(t, token, JSON.stringify({ text: "next minute" }))).status).toBe(200);
  });
});
