// @vitest-environment edge-runtime
/// <reference types="vitest" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { safeReturnUrl } from "./composio";

const OWNER_A = "11111111-1111-4111-8111-111111111111";
const OWNER_B = "22222222-2222-4222-8222-222222222222";

async function setup(deadline?: string) {
  const t = convexTest(schema, modules);
  await t.mutation(api.users.ensure, { ownerId: OWNER_A });
  await t.mutation(api.users.ensure, { ownerId: OWNER_B });
  const itemId = await t.run(async (ctx) => {
    const user = (await ctx.db.query("users").withIndex("by_ownerId", (q) => q.eq("ownerId", OWNER_A)).unique())!;
    return await ctx.db.insert("savedItems", {
      userId: user._id,
      sourceKind: "text",
      sourcePlatform: "manual",
      title: "Hack Night",
      summary: "Build stuff",
      location: "SF",
      deadline,
      contentTypes: ["event"],
      extractionStatus: "ready",
      searchText: "hack night",
      createdAt: 1,
      updatedAt: 1,
    });
  });
  return { t, itemId };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("COMPOSIO_API_KEY", "test-key");
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ successful: true, data: { htmlLink: "https://cal/e/1" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("calendar agent", () => {
  it("drafts from the deadline and only approve calls Composio", async () => {
    const { t, itemId } = await setup("2026-12-01");
    const jobId = await t.mutation(api.agents.calendar.prepare, { ownerId: OWNER_A, itemId, timezone: "America/Los_Angeles" });
    const job = await t.query(api.agents.calendar.latestForItem, { ownerId: OWNER_A, itemId });
    expect(job).toMatchObject({ status: "needs_approval", proposal: { summary: "Hack Night", startDateTime: "2026-12-01T09:00:00", location: "SF" } });
    expect(fetchMock).not.toHaveBeenCalled();
    await t.mutation(api.agents.calendar.approve, { ownerId: OWNER_A, jobId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/tools/execute/GOOGLECALENDAR_CREATE_EVENT");
    const body = JSON.parse(init.body);
    expect(body.user_id).not.toBe(OWNER_A);
    expect(body.arguments).toMatchObject({ start_datetime: "2026-12-01T09:00:00", calendar_id: "primary", create_meeting_room: false });
    expect(await t.query(api.agents.calendar.latestForItem, { ownerId: OWNER_A, itemId })).toMatchObject({ status: "completed", resultUrl: "https://cal/e/1" });
  });

  it("leaves the date empty when the source has none and blocks approval", async () => {
    const { t, itemId } = await setup(undefined);
    const jobId = await t.mutation(api.agents.calendar.prepare, { ownerId: OWNER_A, itemId });
    const job = await t.query(api.agents.calendar.latestForItem, { ownerId: OWNER_A, itemId });
    expect(job?.proposal.startDateTime).toBe("");
    await expect(t.mutation(api.agents.calendar.approve, { ownerId: OWNER_A, jobId })).rejects.toThrow(/start date/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cancelled jobs never call Composio and failed jobs retry", async () => {
    const { t, itemId } = await setup("2026-12-01");
    const jobId = await t.mutation(api.agents.calendar.prepare, { ownerId: OWNER_A, itemId });
    await t.mutation(api.agents.calendar.approve, { ownerId: OWNER_A, jobId });
    await t.mutation(api.agents.calendar.cancel, { ownerId: OWNER_A, jobId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).not.toHaveBeenCalled();
    await t.mutation(api.agents.calendar.retry, { ownerId: OWNER_A, jobId });
    expect((await t.query(api.agents.calendar.latestForItem, { ownerId: OWNER_A, itemId }))?.status).toBe("needs_approval");
  });

  it("refuses another owner", async () => {
    const { t, itemId } = await setup("2026-12-01");
    const jobId = await t.mutation(api.agents.calendar.prepare, { ownerId: OWNER_A, itemId });
    await expect(t.mutation(api.agents.calendar.prepare, { ownerId: OWNER_B, itemId })).rejects.toThrow();
    await expect(t.mutation(api.agents.calendar.approve, { ownerId: OWNER_B, jobId })).rejects.toThrow();
    await expect(t.query(api.agents.calendar.latestForItem, { ownerId: OWNER_B, itemId })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("configured returns only a boolean", async () => {
    const { t } = await setup();
    expect(await t.query(api.agents.calendar.configured, { ownerId: OWNER_A })).toBe(true);
    vi.stubEnv("COMPOSIO_API_KEY", "");
    expect(await t.query(api.agents.calendar.configured, { ownerId: OWNER_A })).toBe(false);
  });
});

describe("callback allow-list", () => {
  it("only allows app deep links", async () => {
    expect(safeReturnUrl("exp://192.168.1.2:8081/--/profile")).not.toBeNull();
    expect(safeReturnUrl("https://evil.example.com")).toBeNull();
    expect(safeReturnUrl("javascript:alert(1)")).toBeNull();
    expect(safeReturnUrl(null)).toBeNull();
    const { t } = await setup();
    const ok = await t.fetch("/composio/callback?status=success&return=" + encodeURIComponent("exp://h:8081/--/profile"));
    expect(ok.status).toBe(302);
    expect(ok.headers.get("Location")).toBe("exp://h:8081/--/profile?gcal=connected");
    expect((await t.fetch("/composio/callback?return=" + encodeURIComponent("https://evil.example.com"))).status).toBe(400);
    expect((await t.fetch("/composio/callback")).status).toBe(400);
  });
});
