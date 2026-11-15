/// <reference types="vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkedinAdapter } from "./linkedin";
import { runTestPost, testPostText } from "./testPost";
import type { PublishAdapter } from "./types";
import { xAdapter } from "./x";

const FAKE_ENV = {
  X_API_KEY: "test-key",
  X_API_SECRET: "test-secret",
  X_ACCESS_TOKEN: "test-token",
  X_ACCESS_TOKEN_SECRET: "test-token-secret",
  LINKEDIN_ACCESS_TOKEN: "test-li-token",
  LINKEDIN_PERSON_URN: "urn:li:person:test",
};

function mockFetch(res: Response) {
  const fn = vi.fn(async (_url: string, _init: RequestInit) => res);
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  for (const [k, v] of Object.entries(FAKE_ENV)) vi.stubEnv(k, v);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("testPostText", () => {
  it("builds the exact text", () => {
    expect(testPostText("09:05:07")).toBe("Testing Zapy 09:05:07");
  });
  it.each(["9:05:07", "24:00:00", "12:60:00", "12:00", "12:00:00 https://x.com"])("rejects %s", (t: string) => {
    expect(() => testPostText(t)).toThrow();
  });
});

describe("runTestPost on X", () => {
  it("returns the post id on 201", async () => {
    const fetch = mockFetch(new Response(JSON.stringify({ data: { id: "1857" } }), { status: 201 }));
    const r = await runTestPost(xAdapter, "Testing Zapy 10:00:00");
    expect(r).toMatchObject({ status: "published", externalPostId: "1857", url: "https://x.com/i/status/1857" });
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1].body))).toEqual({ text: "Testing Zapy 10:00:00" });
  });
  it("fails on 401", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(new Response("{}", { status: 401 }));
    const r = await runTestPost(xAdapter, "Testing Zapy 10:00:00");
    expect(r.status).toBe("failed");
  });
  it("fails when 201 has no id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(new Response("{}", { status: 201 }));
    const r = await runTestPost(xAdapter, "Testing Zapy 10:00:00");
    expect(r.status).toBe("failed");
  });
  it("fails without posting when not configured", async () => {
    vi.stubEnv("X_ACCESS_TOKEN", "");
    const fetch = mockFetch(new Response("{}", { status: 201 }));
    expect(await runTestPost(xAdapter, "t")).toEqual({ status: "failed", error: "This account is not connected." });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fails when the network throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
    expect(await runTestPost(xAdapter, "t")).toEqual({ status: "failed", error: "Could not reach the platform. Try again." });
  });
});

describe("runTestPost on LinkedIn", () => {
  it("returns the post urn from x-restli-id", async () => {
    mockFetch(new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:42" } }));
    const r = await runTestPost(linkedinAdapter, "Testing Zapy 10:00:00");
    expect(r).toMatchObject({ status: "published", externalPostId: "urn:li:share:42" });
  });
  it("fails on 401", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(new Response("{}", { status: 401 }));
    expect((await runTestPost(linkedinAdapter, "t")).status).toBe("failed");
  });
});

describe("runTestPost guards", () => {
  it("never reports published without an id", async () => {
    const adapter: PublishAdapter = {
      platform: "x",
      isConfigured: () => true,
      publish: async () => ({ status: "published", externalPostId: "", url: "", externalPostIds: [] }),
    };
    expect(await runTestPost(adapter, "t")).toEqual({ status: "failed", error: "The platform did not return a post id." });
  });
  it("fails for a missing adapter", async () => {
    expect((await runTestPost(undefined, "t")).status).toBe("failed");
  });
});
