/// <reference types="vitest" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStarredPage, GitHubApiError, normalizeUsername, parseStarred, STARS_PER_PAGE, type StarredEntry } from "./githubClient";

export function starredRepo(id: number, extra: Record<string, unknown> = {}): StarredEntry {
  return {
    starred_at: new Date(Date.UTC(2026, 10, 1) + id * 1000).toISOString(),
    repo: {
      id,
      full_name: `octo/repo-${id}`,
      html_url: `https://github.com/octo/repo-${id}`,
      description: `Repo number ${id}`,
      language: "TypeScript",
      stargazers_count: 100 + id,
      topics: ["cli", "ai"],
      ...extra,
    },
  };
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("githubClient", () => {
  it("normalizes usernames and rejects invalid ones", () => {
    expect(normalizeUsername(" @octocat ")).toBe("octocat");
    expect(normalizeUsername("https://github.com/octo-cat/")).toBe("octo-cat");
    expect(normalizeUsername("bad name")).toBeNull();
    expect(normalizeUsername("-leading")).toBeNull();
    expect(normalizeUsername("")).toBeNull();
  });

  it("parses starred repos into import posts, with or without the starred_at wrapper", () => {
    const wrapped = starredRepo(7);
    const bare = (starredRepo(8, { full_name: "octo/repo-7", description: null, language: null, topics: [], stargazers_count: 107 }) as { repo: StarredEntry }).repo;
    const [a, b] = parseStarred([wrapped, bare]);
    expect(a).toEqual({
      platform: "github",
      externalId: "7",
      url: "https://github.com/octo/repo-7",
      text: "Starred GitHub repository: octo/repo-7\nDescription: Repo number 7\nLanguage: TypeScript\nStars: 107\nTopics: cli, ai",
      savedAt: Date.UTC(2026, 10, 1) + 7000,
    });
    expect(b).toMatchObject({ externalId: "8", text: "Starred GitHub repository: octo/repo-7\nStars: 107", savedAt: undefined });
  });

  it("requests newest-first pages, sends GITHUB_TOKEN when set, and reports hasMore", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_test");
    const full = Array.from({ length: STARS_PER_PAGE }, (_, i) => starredRepo(i + 1));
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => json(full));
    vi.stubGlobal("fetch", fetch);
    const { stars, hasMore } = await fetchStarredPage("octocat", 2);
    expect(stars).toHaveLength(STARS_PER_PAGE);
    expect(hasMore).toBe(true);
    const [url, init] = fetch.mock.calls[0]!;
    const parsed = new URL(url);
    expect(parsed.pathname).toBe("/users/octocat/starred");
    expect(Object.fromEntries(parsed.searchParams)).toMatchObject({ sort: "created", direction: "desc", page: "2" });
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer ghp_test");
  });

  it("calls GitHub unauthenticated when GITHUB_TOKEN is unset", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => json([starredRepo(1)]));
    vi.stubGlobal("fetch", fetch);
    expect((await fetchStarredPage("octocat", 1)).hasMore).toBe(false);
    expect((fetch.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("maps 404 to a bad-username error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "Not Found" }, 404)));
    const error = await fetchStarredPage("ghost-user", 1).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitHubApiError);
    expect(error).toMatchObject({ status: 404, message: 'GitHub user "ghost-user" doesn\'t exist.' });
  });

  it("maps 403 rate limits and 429 to a rate-limit message", async () => {
    const reset = String(Math.floor(Date.now() / 1000) + 300);
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "API rate limit exceeded" }, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": reset })));
    await expect(fetchStarredPage("octocat", 1)).rejects.toThrow("GitHub is rate-limiting Zapy right now. Try again in about 5 min.");
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 429, { "retry-after": "30" })));
    await expect(fetchStarredPage("octocat", 1)).rejects.toThrow("Try again in about 1 min.");
  });
});
