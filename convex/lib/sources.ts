// OWNER: Thread B+C. Source fetchers for ingestion. Default Convex runtime
// (fetch only, no Node built-ins), so call these from actions.

import { detectSourcePlatform, type SourcePlatform } from "../../src/shared/contracts";

/** One piece of material handed to analysis. `source` becomes FactEvidence.source. */
export type SourcePart = { source: string; label: string; text: string };

export type FetchedSource =
  | { ok: true; title?: string; part: SourcePart }
  | { ok: false; reason: string };

const MAX_TEXT_CHARS = 14000;
const FETCH_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const LOGIN_WALLED: Partial<Record<SourcePlatform, string>> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  threads: "Threads",
};

function askForContent(what: string): string {
  return `${what} Add a screenshot or paste the text and we'll take it from there.`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", mdash: "—", ndash: "–", hellip: "…", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function metaContent(html: string, key: string): string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (name !== key) continue;
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1];
    if (content?.trim()) return decodeEntities(content.trim());
  }
  return undefined;
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe|form|nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Structured data many restaurant, event, recipe, and job pages embed. */
function jsonLd(html: string): string {
  const blocks = [...html.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks
    .map((m) => m[1].trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

function readableHtml(html: string): string {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<article\b[\s\S]*?<\/article>/i)?.[0];
  const text = main ? htmlToText(main) : "";
  return text.length >= 400 ? text : htmlToText(html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html);
}

function looksLikeLoginWall(title: string, text: string): boolean {
  const sample = `${title} ${text.slice(0, 1500)}`.toLowerCase();
  return text.length < 1500 && /(log ?in|sign ?in|sign up|create an account|verify you are human|access denied|enable javascript|captcha)/.test(sample);
}

/** Fetches any web page and returns title, meta description, structured data, and readable text. */
export async function fetchWebPage(url: string): Promise<FetchedSource> {
  const platform = detectSourcePlatform(url);
  const walled = LOGIN_WALLED[platform];
  if (walled) return { ok: false, reason: askForContent(`${walled} doesn't let us read posts without logging in.`) };

  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5", "Accept-Language": "en-US,en;q=0.9" },
    });
  } catch {
    return { ok: false, reason: askForContent("We couldn't reach that link. It may be offline or mistyped.") };
  }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: askForContent(`That page is behind a login or blocked automated access (HTTP ${response.status}).`) };
  }
  if (response.status === 404 || response.status === 410) {
    return { ok: false, reason: askForContent(`That page doesn't exist (HTTP ${response.status}).`) };
  }
  if (!response.ok) return { ok: false, reason: askForContent(`That page didn't load (HTTP ${response.status}).`) };

  const contentType = response.headers.get("content-type") ?? "";
  if (!/html|text\/plain|xml/i.test(contentType)) {
    return { ok: false, reason: askForContent(`That link is a file we can't read yet (${contentType.split(";")[0] || "unknown type"}).`) };
  }
  const raw = (await response.text()).slice(0, 1_500_000);
  if (/text\/plain/i.test(contentType)) {
    return { ok: true, part: { source: response.url || url, label: "Web page", text: raw.slice(0, MAX_TEXT_CHARS) } };
  }

  const title = metaContent(raw, "og:title") ?? decodeEntities(raw.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");
  const description = metaContent(raw, "og:description") ?? metaContent(raw, "description");
  const siteName = metaContent(raw, "og:site_name");
  const structured = jsonLd(raw);
  const body = readableHtml(raw);
  if (looksLikeLoginWall(title, body) && !description) {
    return { ok: false, reason: askForContent("That page asks for a login before showing its content.") };
  }
  if (body.length < 200 && !description && !structured) {
    return { ok: false, reason: askForContent("That page didn't have readable text (it may need JavaScript or a login).") };
  }
  const text = [
    title && `Title: ${title}`,
    siteName && `Site: ${siteName}`,
    description && `Description: ${description}`,
    structured && `Structured data (JSON-LD):\n${structured}`,
    `Page text:\n${body}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_TEXT_CHARS);
  return { ok: true, title: title || undefined, part: { source: response.url || url, label: "Web page", text } };
}

/** owner/repo from a github.com URL, or null for profiles, search, etc. */
export function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)(?:[/?#]|$)/i);
  if (!match) return null;
  const reserved = ["orgs", "topics", "search", "settings", "marketplace", "explore", "features", "sponsors", "collections", "trending", "apps", "login", "about"];
  if (reserved.includes(match[1].toLowerCase())) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

type GitHubRepo = {
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  topics?: string[];
  license: { spdx_id: string | null; name: string } | null;
  default_branch: string;
  archived: boolean;
  pushed_at: string;
};

/** Repository metadata and README through the GitHub REST API (unauthenticated). */
export async function fetchGitHubRepo(owner: string, repo: string): Promise<FetchedSource> {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "AfterScroll", "X-GitHub-Api-Version": "2022-11-28" };
  let meta: Response;
  try {
    meta = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  } catch {
    return { ok: false, reason: askForContent("We couldn't reach GitHub just now.") };
  }
  if (meta.status === 404) return { ok: false, reason: askForContent(`GitHub says ${owner}/${repo} doesn't exist or is private.`) };
  if (!meta.ok) return { ok: false, reason: `GitHub API error (HTTP ${meta.status})` };
  const data = (await meta.json()) as GitHubRepo;

  let readme = "";
  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: { ...headers, Accept: "application/vnd.github.raw+json" },
    });
    if (res.ok) readme = await res.text();
  } catch {
    readme = "";
  }

  const text = [
    `Repository: ${data.full_name}`,
    data.description && `Description: ${data.description}`,
    `Stars: ${data.stargazers_count}`,
    `Forks: ${data.forks_count}`,
    `Open issues: ${data.open_issues_count}`,
    data.language && `Primary language: ${data.language}`,
    data.license && `License: ${data.license.spdx_id ?? data.license.name}`,
    data.topics?.length ? `Topics: ${data.topics.join(", ")}` : "",
    data.homepage && `Homepage: ${data.homepage}`,
    `Default branch: ${data.default_branch}`,
    `Last push: ${data.pushed_at}`,
    data.archived ? "Archived: yes" : "",
    readme ? `\nREADME:\n${readme}` : "\nREADME: (none found)",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT_CHARS);
  return { ok: true, title: data.full_name, part: { source: data.html_url, label: "GitHub repository", text } };
}

/** Routes a saved URL to the right fetcher. */
export async function fetchUrl(url: string): Promise<FetchedSource> {
  try {
    new URL(url);
  } catch {
    return { ok: false, reason: askForContent("That doesn't look like a valid link.") };
  }
  const repo = detectSourcePlatform(url) === "github" ? parseGitHubRepo(url) : null;
  return repo ? await fetchGitHubRepo(repo.owner, repo.repo) : await fetchWebPage(url);
}

/** Downloads an uploaded image and returns it as a data URL for vision. */
export async function imageToDataUrl(url: string): Promise<string> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Couldn't load the uploaded image (HTTP ${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Image is larger than 8 MB");
  const mime = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}
