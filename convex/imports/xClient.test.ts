/// <reference types="vitest" />
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchBookmarksPage,
  parseBookmarks,
  pkceChallenge,
  refreshTokens,
  X_TOKEN_URL,
  XApiError,
  type XBookmarksResponse,
} from "./xClient";

function mockFetch(...responses: Response[]) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift() ?? new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

export const BOOKMARKS_PAGE: XBookmarksResponse = {
  data: [
    {
      id: "1001",
      text: "Free Rust course, apply by Dec 1 https://t.co/abc",
      author_id: "u1",
      entities: { urls: [{ start: 33, end: 50, url: "https://t.co/abc", expanded_url: "https://rust.example.com/course" }] },
      attachments: { media_keys: ["m1"] },
    },
    {
      id: "1002",
      text: "Short version…",
      author_id: "u2",
      note_tweet: { text: "The long version of this post with a link https://t.co/xyz", entities: { urls: [{ start: 0, end: 0, url: "https://t.co/xyz", expanded_url: "https://long.example.com" }] } },
      attachments: { media_keys: ["m2"] },
    },
    { id: "1003", text: "No author expansion" },
  ],
  includes: {
    users: [
      { id: "u1", username: "rustlang", name: "Rust" },
      { id: "u2", username: "writer" },
    ],
    media: [
      { media_key: "m1", type: "photo", url: "https://pbs.twimg.com/media/photo.jpg" },
      { media_key: "m2", type: "video", preview_image_url: "https://pbs.twimg.com/thumb.jpg" },
    ],
  },
  meta: { result_count: 3, next_token: "next-1" },
};

describe("PKCE + authorize URL", () => {
  it("computes the RFC 7636 S256 challenge", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("asks for the bookmark scopes with S256", () => {
    const url = new URL(buildAuthorizeUrl({ clientId: "cid", redirectUri: "https://dep.convex.site/oauth/x/callback", state: "s1", codeChallenge: "c1" }));
    expect(url.origin + url.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "cid",
      redirect_uri: "https://dep.convex.site/oauth/x/callback",
      scope: "tweet.read users.read bookmark.read offline.access",
      state: "s1",
      code_challenge: "c1",
      code_challenge_method: "S256",
    });
  });
});

describe("token exchange", () => {
  it("uses Basic auth for a confidential client", async () => {
    const fetch = mockFetch(json({ access_token: "at", refresh_token: "rt", expires_in: 7200, scope: "bookmark.read" }));
    const before = Date.now();
    const tokens = await exchangeCode({ code: "code1", codeVerifier: "ver1", redirectUri: "https://cb" }, { clientId: "cid", clientSecret: "secret" });
    expect(tokens).toMatchObject({ accessToken: "at", refreshToken: "rt", scope: "bookmark.read" });
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 7200 * 1000);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(X_TOKEN_URL);
    expect((init!.headers as Record<string, string>).Authorization).toBe("Basic " + btoa("cid:secret"));
    expect(Object.fromEntries(new URLSearchParams(String(init!.body)))).toEqual({
      grant_type: "authorization_code",
      code: "code1",
      redirect_uri: "https://cb",
      code_verifier: "ver1",
    });
  });

  it("sends client_id in the body for a public client", async () => {
    const fetch = mockFetch(json({ access_token: "at2", expires_in: 60 }));
    await refreshTokens("rt", { clientId: "cid" });
    const init = fetch.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({ grant_type: "refresh_token", refresh_token: "rt", client_id: "cid" });
  });

  it("surfaces X's error_description", async () => {
    mockFetch(json({ error: "invalid_request", error_description: "Value passed for the authorization code was invalid." }, 400));
    await expect(exchangeCode({ code: "bad", codeVerifier: "v", redirectUri: "https://cb" }, { clientId: "cid" })).rejects.toThrow(
      "Value passed for the authorization code was invalid.",
    );
  });
});

describe("bookmarks", () => {
  it("parses text, expanded links, authors, images, and the next token", () => {
    const { posts, nextToken } = parseBookmarks(BOOKMARKS_PAGE);
    expect(nextToken).toBe("next-1");
    expect(posts).toEqual([
      {
        platform: "x",
        externalId: "1001",
        url: "https://x.com/rustlang/status/1001",
        text: "Free Rust course, apply by Dec 1 https://rust.example.com/course",
        author: "Rust (@rustlang)",
        imageUrl: "https://pbs.twimg.com/media/photo.jpg",
      },
      {
        platform: "x",
        externalId: "1002",
        url: "https://x.com/writer/status/1002",
        text: "The long version of this post with a link https://long.example.com",
        author: "@writer",
        imageUrl: "https://pbs.twimg.com/thumb.jpg",
      },
      { platform: "x", externalId: "1003", url: "https://x.com/i/status/1003", text: "No author expansion", author: undefined, imageUrl: undefined },
    ]);
  });

  it("handles an empty page", () => {
    expect(parseBookmarks({ meta: { result_count: 0 } })).toEqual({ posts: [], nextToken: undefined });
  });

  it("requests expansions and pagination with a bearer token", async () => {
    const fetch = mockFetch(json(BOOKMARKS_PAGE));
    await fetchBookmarksPage("at", "42", "tok-2");
    const [raw, init] = fetch.mock.calls[0]!;
    const url = new URL(raw);
    expect(url.pathname).toBe("/2/users/42/bookmarks");
    expect(url.searchParams.get("pagination_token")).toBe("tok-2");
    expect(url.searchParams.get("expansions")).toBe("author_id,attachments.media_keys");
    expect(url.searchParams.get("max_results")).toBe("100");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer at");
  });

  it("maps 401 and 429 to readable errors", async () => {
    mockFetch(json({ title: "Unauthorized" }, 401), json({ title: "Too Many Requests" }, 429, { "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 300) }));
    await expect(fetchBookmarksPage("at", "42")).rejects.toThrow("Reconnect X");
    const err = await fetchBookmarksPage("at", "42").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(XApiError);
    expect((err as XApiError).message).toMatch(/rate limit.*5 min/);
  });
});

