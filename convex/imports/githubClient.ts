// OWNER: GitHub stars import thread (ZUB-19). GitHub REST client for a user's starred repos.
// Pure fetch code with no Convex imports, so it is unit-tested with a mocked fetch.

export const GITHUB_API = "https://api.github.com";
export const STARS_PER_PAGE = 30;

const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export type ImportedGitHubStar = {
  platform: "github";
  externalId: string;
  url: string;
  text: string;
  savedAt?: number;
};

type StarredRepo = {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics?: string[];
};

/** One entry from /users/<name>/starred, with or without the star+json starred_at wrapper. */
export type StarredEntry = StarredRepo | { starred_at: string; repo: StarredRepo };

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Trims a leading @ or a github.com profile URL; null when it isn't a valid GitHub username. */
export function normalizeUsername(raw: string): string | null {
  const name = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return USERNAME.test(name) ? name : null;
}

function repoText(repo: StarredRepo): string {
  return [
    `Starred GitHub repository: ${repo.full_name}`,
    repo.description && `Description: ${repo.description}`,
    repo.language && `Language: ${repo.language}`,
    `Stars: ${repo.stargazers_count}`,
    repo.topics?.length ? `Topics: ${repo.topics.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseStarred(entries: StarredEntry[]): ImportedGitHubStar[] {
  return entries.map((entry) => {
    const repo = "repo" in entry ? entry.repo : entry;
    const starredAt = "starred_at" in entry ? Date.parse(entry.starred_at) : NaN;
    return {
      platform: "github",
      externalId: String(repo.id),
      url: repo.html_url,
      text: repoText(repo),
      savedAt: Number.isFinite(starredAt) ? starredAt : undefined,
    };
  });
}

function rateLimitMessage(res: Response): string {
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  const retryAfter = Number(res.headers.get("retry-after"));
  const seconds = retryAfter > 0 ? retryAfter : reset > 0 ? Math.max(0, reset - Math.floor(Date.now() / 1000)) : 0;
  const wait = seconds ? ` Try again in about ${Math.max(1, Math.ceil(seconds / 60))} min.` : " Try again later.";
  return `GitHub is rate-limiting Zapy right now.${wait}`;
}

/** One page of a user's stars, newest first. hasMore is true when another page may exist. */
export async function fetchStarredPage(username: string, page: number): Promise<{ stars: ImportedGitHubStar[]; hasMore: boolean }> {
  const token = process.env.GITHUB_TOKEN;
  const url = `${GITHUB_API}/users/${encodeURIComponent(username)}/starred?sort=created&direction=desc&per_page=${STARS_PER_PAGE}&page=${page}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.star+json",
        "User-Agent": "Zapy",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new GitHubApiError("Couldn't reach GitHub. Check your connection and try again.", 0);
  }
  if (res.status === 404) throw new GitHubApiError(`GitHub user "${username}" doesn't exist.`, 404);
  if (res.status === 429 || (res.status === 403 && (res.headers.get("x-ratelimit-remaining") === "0" || res.headers.has("retry-after")))) {
    throw new GitHubApiError(rateLimitMessage(res), res.status);
  }
  if (!res.ok) throw new GitHubApiError(`GitHub returned an error (HTTP ${res.status}).`, res.status);
  const entries = (await res.json()) as StarredEntry[];
  return { stars: parseStarred(entries), hasMore: entries.length === STARS_PER_PAGE };
}
