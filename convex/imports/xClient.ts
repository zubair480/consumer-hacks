// OWNER: Import thread (CONS-19). X (Twitter) API v2 client for importing bookmarks.
// OAuth 2.0 Authorization Code + PKCE. Pure fetch code with no Convex imports, so it is
// unit-tested with a mocked fetch. Tokens never leave the server.

export const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const X_API = "https://api.x.com/2";
export const X_SCOPES = ["tweet.read", "users.read", "bookmark.read", "offline.access"];
export const X_CALLBACK_PATH = "/oauth/x/callback";

export type XCredentials = { clientId: string; clientSecret?: string };

export type XTokens = { accessToken: string; refreshToken?: string; expiresAt: number; scope?: string };

export type ImportedXPost = {
  platform: "x";
  externalId: string;
  url: string;
  text: string;
  author?: string;
  imageUrl?: string;
};

/** Reads X_CLIENT_ID / X_CLIENT_SECRET from the Convex env; null when X import is not configured. */
export function xCredentials(): XCredentials | null {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) return null;
  return { clientId, clientSecret: process.env.X_CLIENT_SECRET || undefined };
}

export function xRedirectUri(): string {
  const site = process.env.CONVEX_SITE_URL;
  if (!site) throw new Error("CONVEX_SITE_URL is not set");
  return site.replace(/\/$/, "") + X_CALLBACK_PATH;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** A fresh PKCE verifier (43 chars) and its S256 challenge. */
export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { verifier, challenge: await pkceChallenge(verifier) };
}

export function buildAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: X_SCOPES.join(" "),
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${X_AUTHORIZE_URL}?${params}`;
}

export class XApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type XProblem = { title?: string; detail?: string; type?: string; reason?: string; message?: string };

function describeProblem(problem: XProblem): string {
  return [problem.title, problem.detail ?? problem.message, problem.reason].filter(Boolean).join(": ");
}

async function failure(res: Response, what: string): Promise<XApiError> {
  const body = await res.text().catch(() => "");
  let detail = body.slice(0, 200);
  try {
    const json = JSON.parse(body) as XProblem & { error_description?: string; error?: string; errors?: XProblem[] };
    const problem = json.title || json.detail ? json : json.errors?.[0];
    console.error(`${what} failed`, res.status, JSON.stringify({ title: problem?.title, detail: problem?.detail, type: problem?.type, error: json.error }));
    detail = json.error_description ?? (problem ? describeProblem(problem) : undefined) ?? json.error ?? detail;
  } catch {
    console.error(`${what} failed`, res.status, detail);
  }
  if (res.status === 429) {
    const reset = Number(res.headers.get("x-rate-limit-reset"));
    const minutes = reset ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : null;
    return new XApiError(`X rate limit reached${minutes ? `; try again in ${minutes} min` : ""}.`, 429);
  }
  if (res.status === 401) return new XApiError(`X access expired or was revoked. Reconnect X. (${detail})`, 401);
  if (res.status === 403) return new XApiError(`X refused access to ${what === "X bookmarks" ? "your bookmarks" : "your account"} (403): ${detail}`, 403);
  return new XApiError(`${what} failed (${res.status}): ${detail}`, res.status);
}

async function tokenRequest(fields: Record<string, string>, creds: XCredentials): Promise<XTokens> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body = new URLSearchParams(fields);
  if (creds.clientSecret) headers.Authorization = "Basic " + btoa(`${creds.clientId}:${creds.clientSecret}`);
  else body.set("client_id", creds.clientId);
  const res = await fetch(X_TOKEN_URL, { method: "POST", headers, body: body.toString() });
  if (!res.ok) throw await failure(res, "X token request");
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  if (!json.access_token) throw new XApiError("X token response had no access_token", 502);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 7200) * 1000,
    scope: json.scope,
  };
}

export function exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }, creds: XCredentials): Promise<XTokens> {
  return tokenRequest(
    { grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri, code_verifier: input.codeVerifier },
    creds,
  );
}

export function refreshTokens(refreshToken: string, creds: XCredentials): Promise<XTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, creds);
}

export async function fetchMe(accessToken: string): Promise<{ id: string; username: string }> {
  const res = await fetch(`${X_API}/users/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw await failure(res, "X /users/me");
  const json = (await res.json()) as { data?: { id: string; username: string } };
  if (!json.data?.id) throw new XApiError("X /users/me returned no user", 502);
  return { id: json.data.id, username: json.data.username };
}

type XUrlEntity = { start: number; end: number; url: string; expanded_url?: string };
type XTweet = {
  id: string;
  text: string;
  author_id?: string;
  note_tweet?: { text: string; entities?: { urls?: XUrlEntity[] } };
  entities?: { urls?: XUrlEntity[] };
  attachments?: { media_keys?: string[] };
};
type XUser = { id: string; username: string; name?: string };
type XMedia = { media_key: string; type: string; url?: string; preview_image_url?: string };
export type XBookmarksResponse = {
  data?: XTweet[];
  errors?: XProblem[];
  includes?: { users?: XUser[]; media?: XMedia[] };
  meta?: { next_token?: string; result_count?: number };
};

function expandLinks(text: string, urls: XUrlEntity[] | undefined): string {
  let out = text;
  for (const u of urls ?? []) if (u.expanded_url) out = out.split(u.url).join(u.expanded_url);
  return out;
}

/** Turns one bookmarks page into importable posts plus the next pagination token. */
export function parseBookmarks(json: XBookmarksResponse): { posts: ImportedXPost[]; nextToken?: string } {
  const users = new Map((json.includes?.users ?? []).map((u) => [u.id, u]));
  const media = new Map((json.includes?.media ?? []).map((m) => [m.media_key, m]));
  const posts = (json.data ?? []).map((tweet): ImportedXPost => {
    const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
    const body = tweet.note_tweet
      ? expandLinks(tweet.note_tweet.text, tweet.note_tweet.entities?.urls)
      : expandLinks(tweet.text, tweet.entities?.urls);
    const firstMedia = (tweet.attachments?.media_keys ?? []).map((k) => media.get(k)).find(Boolean);
    const imageUrl = firstMedia ? (firstMedia.type === "photo" ? firstMedia.url : firstMedia.preview_image_url) : undefined;
    return {
      platform: "x",
      externalId: tweet.id,
      url: `https://x.com/${user?.username ?? "i"}/status/${tweet.id}`,
      text: body,
      author: user ? (user.name ? `${user.name} (@${user.username})` : `@${user.username}`) : undefined,
      imageUrl,
    };
  });
  return { posts, nextToken: json.meta?.next_token };
}

export async function fetchBookmarksPage(
  accessToken: string,
  userId: string,
  paginationToken?: string,
): Promise<{ posts: ImportedXPost[]; nextToken?: string }> {
  const params = new URLSearchParams({
    max_results: "100",
    expansions: "author_id,attachments.media_keys",
    "tweet.fields": "created_at,author_id,entities,note_tweet,attachments",
    "user.fields": "username,name",
    "media.fields": "type,url,preview_image_url",
  });
  if (paginationToken) params.set("pagination_token", paginationToken);
  const res = await fetch(`${X_API}/users/${encodeURIComponent(userId)}/bookmarks?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw await failure(res, "X bookmarks");
  const json = (await res.json()) as XBookmarksResponse;
  if (!json.data?.length && json.errors?.length) {
    const problem = json.errors[0]!;
    console.error("X bookmarks returned errors", JSON.stringify(json.errors.map(({ title, detail, type }) => ({ title, detail, type }))));
    throw new XApiError(`X bookmarks failed: ${describeProblem(problem) || "unknown error"}`, 502);
  }
  return parseBookmarks(json);
}
