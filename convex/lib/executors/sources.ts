// OWNER: D+E. Gathers the real source material an executor may use.
// Everything an executor states must be traceable to this text, the saved
// item's own text/image, or the analysis facts (which carry evidence).

const MAX_PAGE_CHARS = 16000;
const MAX_README_CHARS = 24000;

export type GithubRepo = {
  fullName: string;
  url: string;
  description: string | null;
  homepage: string | null;
  language: string | null;
  stars: number;
  forks: number;
  license: string | null;
  topics: string[];
  defaultBranch: string;
  pushedAt: string | null;
  readme: string | null;
  readmeUrl: string | null;
};

export function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  const m = url.match(/^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i);
  if (!m) return null;
  const repo = m[2].replace(/\.git$/i, "");
  if (["orgs", "topics", "search", "settings", "marketplace", "features"].includes(m[1].toLowerCase())) return null;
  return { owner: m[1], repo };
}

export async function fetchGithubRepo(url: string): Promise<GithubRepo | null> {
  const parsed = parseGithubRepo(url);
  if (!parsed) return null;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "AfterScroll" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const api = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  const metaRes = await fetch(api, { headers });
  if (!metaRes.ok) return null;
  const meta = (await metaRes.json()) as {
    full_name: string;
    html_url: string;
    description: string | null;
    homepage: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    license: { spdx_id?: string; name?: string } | null;
    topics?: string[];
    default_branch: string;
    pushed_at: string | null;
  };
  let readme: string | null = null;
  let readmeUrl: string | null = null;
  const readmeRes = await fetch(`${api}/readme`, { headers: { ...headers, Accept: "application/vnd.github.raw+json" } });
  if (readmeRes.ok) {
    readme = (await readmeRes.text()).slice(0, MAX_README_CHARS);
    readmeUrl = `${meta.html_url}#readme`;
  }
  return {
    fullName: meta.full_name,
    url: meta.html_url,
    description: meta.description,
    homepage: meta.homepage || null,
    language: meta.language,
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    license: meta.license?.spdx_id && meta.license.spdx_id !== "NOASSERTION" ? meta.license.spdx_id : meta.license?.name ?? null,
    topics: meta.topics ?? [],
    defaultBranch: meta.default_branch,
    pushedAt: meta.pushed_at,
    readme,
    readmeUrl,
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<a\s[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => `${inner} (${href}) `)
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/** Readable text of a web page, or null when it cannot be fetched. */
export async function fetchPageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AfterScroll/1.0)", Accept: "text/html,text/plain" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) return null;
    const text = htmlToText(await res.text());
    return text.length > 80 ? text.slice(0, MAX_PAGE_CHARS) : null;
  } catch {
    return null;
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[`*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Verifies that a quote actually appears in the source corpus. */
export function makeVerifier(corpus: string) {
  const hay = normalize(corpus);
  return (quote: string | undefined | null): boolean => {
    if (!quote) return false;
    const needle = normalize(quote);
    if (needle.length < 3) return false;
    if (hay.includes(needle)) return true;
    // Allow the model to elide the middle of a long quote with "...".
    const parts = needle.split(/\s*(?:\.\.\.|…)\s*/).filter((p) => p.length >= 3);
    return parts.length > 1 && parts.every((p) => hay.includes(p));
  };
}
