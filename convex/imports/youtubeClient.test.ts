/// <reference types="vitest" />
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchLikedVideosPage,
  GOOGLE_TOKEN_URL,
  GoogleApiError,
  parseLikedVideos,
  refreshGoogleTokens,
  type YouTubeVideosResponse,
} from "./youtubeClient";

function mockFetch(...responses: Response[]) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift() ?? new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const creds = { clientId: "cid", clientSecret: "secret" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

export function likedPage(ids: string[], nextPageToken?: string): YouTubeVideosResponse {
  return {
    items: ids.map((id) => ({
      id,
      snippet: {
        title: `Video ${id}`,
        description: `Description of ${id}`,
        channelTitle: "Some Channel",
        thumbnails: { default: { url: `https://i.ytimg.com/vi/${id}/default.jpg` }, high: { url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` } },
      },
    })),
    nextPageToken,
  };
}

/** n distinct 11-character video ids. */
export const videoIds = (n: number, prefix = "vid") => Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(11 - prefix.length, "0")}`);

describe("youtubeClient", () => {
  it("builds an offline consent URL for youtube.readonly with PKCE", () => {
    const url = new URL(buildGoogleAuthorizeUrl({ clientId: "cid", redirectUri: "https://dep.convex.site/oauth/google/callback", state: "s1", codeChallenge: "ch" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "cid",
      redirect_uri: "https://dep.convex.site/oauth/google/callback",
      response_type: "code",
      scope: "https://www.googleapis.com/auth/youtube.readonly",
      access_type: "offline",
      prompt: "consent",
      state: "s1",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
  });

  it("exchanges a code for tokens with the client secret in the body", async () => {
    const fetch = mockFetch(json({ access_token: "at", refresh_token: "rt", expires_in: 3599, scope: "https://www.googleapis.com/auth/youtube.readonly" }));
    const before = Date.now();
    const tokens = await exchangeGoogleCode({ code: "c1", codeVerifier: "v1", redirectUri: "https://r" }, creds);
    expect(tokens).toMatchObject({ accessToken: "at", refreshToken: "rt" });
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3599_000);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(GOOGLE_TOKEN_URL);
    expect(Object.fromEntries(new URLSearchParams(String(init!.body)))).toEqual({
      grant_type: "authorization_code",
      code: "c1",
      redirect_uri: "https://r",
      code_verifier: "v1",
      client_id: "cid",
      client_secret: "secret",
    });
  });

  it("refreshes tokens; Google usually omits a new refresh token", async () => {
    const fetch = mockFetch(json({ access_token: "fresh", expires_in: 3600 }));
    const tokens = await refreshGoogleTokens("rt", creds);
    expect(tokens.accessToken).toBe("fresh");
    expect(tokens.refreshToken).toBeUndefined();
    expect(Object.fromEntries(new URLSearchParams(String(fetch.mock.calls[0]![1]!.body)))).toMatchObject({ grant_type: "refresh_token", refresh_token: "rt" });
  });

  it("maps a revoked refresh token to a reconnect message", async () => {
    mockFetch(json({ error: "invalid_grant", error_description: "Token has been expired or revoked." }, 400));
    await expect(refreshGoogleTokens("rt", creds)).rejects.toMatchObject({ status: 401, message: expect.stringContaining("Reconnect YouTube") });
  });

  it("parses liked videos into importable posts", () => {
    const { videos, nextPageToken } = parseLikedVideos(likedPage(["dQw4w9WgXcQ"], "p2"));
    expect(nextPageToken).toBe("p2");
    expect(videos).toEqual([
      {
        platform: "youtube",
        externalId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        text: "Video dQw4w9WgXcQ\n\nChannel: Some Channel\n\nDescription of dQw4w9WgXcQ",
        author: "Some Channel",
        imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      },
    ]);
    expect(parseLikedVideos({ items: [{ id: "abcdefghijk" }] }).videos[0]).toMatchObject({ text: "Untitled video", author: undefined, imageUrl: undefined });
    expect(parseLikedVideos({}).videos).toEqual([]);
  });

  it("requests myRating=like with paging and surfaces quota errors", async () => {
    const fetch = mockFetch(json(likedPage(["dQw4w9WgXcQ"])), json({ error: { code: 403, message: "quota", errors: [{ reason: "quotaExceeded" }] } }, 403));
    await fetchLikedVideosPage("at", 20, "tok");
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.pathname).toBe("/youtube/v3/videos");
    expect(Object.fromEntries(url.searchParams)).toEqual({ myRating: "like", part: "snippet", maxResults: "20", pageToken: "tok" });
    expect((fetch.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBe("Bearer at");
    const err = await fetchLikedVideosPage("at", 20).catch((e) => e);
    expect(err).toBeInstanceOf(GoogleApiError);
    expect(err.message).toContain("quota");
  });
});
