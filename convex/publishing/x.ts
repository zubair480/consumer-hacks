import type { PublishAdapter, PublishResult } from "./types";

// OWNER: Thread J (CONS-11). X adapter: POST /2/tweets signed with OAuth 1.0a (HMAC-SHA1).
// Credentials live only in Convex env; nothing here is returned to the client.

const TWEETS_URL = "https://api.x.com/2/tweets";
const MAX_CHARS = 280;
const URL_WEIGHT = 23;
const THREAD_SEPARATOR = /\n\s*---\s*\n/;

/** RFC 3986 percent-encoding. */
export function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

export type OAuthInput = {
  method: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
  nonce: string;
  timestamp: string;
  /** Extra request params that belong in the signature (none for a JSON body). */
  params?: Record<string, string>;
};

export async function oauthSignature(input: OAuthInput): Promise<{ signature: string; oauthParams: Record<string, string> }> {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: input.consumerKey,
    oauth_nonce: input.nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: input.timestamp,
    oauth_token: input.token,
    oauth_version: "1.0",
  };
  const paramString = Object.entries({ ...oauthParams, ...input.params })
    .map(([k, v]) => [percentEncode(k), percentEncode(v)])
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : 1) : ak < bk ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const base = `${input.method.toUpperCase()}&${percentEncode(input.url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(input.consumerSecret)}&${percentEncode(input.tokenSecret)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base)));
  return { signature: btoa(String.fromCharCode(...mac)), oauthParams };
}

export async function oauthHeader(input: OAuthInput): Promise<string> {
  const { signature, oauthParams } = await oauthSignature(input);
  return (
    "OAuth " +
    Object.entries({ ...oauthParams, oauth_signature: signature })
      .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
      .join(", ")
  );
}

/** X weighting with every URL counted as 23 characters. */
export function xLength(text: string): number {
  return [...text.replace(/https?:\/\/\S+/g, "x".repeat(URL_WEIGHT))].length;
}

/** A composer X thread renders as parts joined by "---" lines; each part is one post. */
export function splitXThread(text: string): string[] {
  return text
    .split(THREAD_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);
}

function credentials() {
  const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
  if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) return null;
  return { consumerKey: X_API_KEY, consumerSecret: X_API_SECRET, token: X_ACCESS_TOKEN, tokenSecret: X_ACCESS_TOKEN_SECRET };
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function xIntentUrl(text: string): string {
  return "https://x.com/intent/tweet?text=" + encodeURIComponent(text);
}

async function postTweet(
  creds: NonNullable<ReturnType<typeof credentials>>,
  body: Record<string, unknown>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const authorization = await oauthHeader({
    method: "POST",
    url: TWEETS_URL,
    ...creds,
    nonce: randomHex(16),
    timestamp: Math.floor(Date.now() / 1000).toString(),
  });
  const res = await fetch(TWEETS_URL, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let json: { data?: { id?: string }; title?: string; detail?: string; type?: string; errors?: unknown } = {};
  try {
    json = JSON.parse(raw);
  } catch {
    json = {};
  }
  const id = json.data?.id;
  if (res.status === 201 && id) return { ok: true, id };
  console.error("X POST /2/tweets failed", {
    status: res.status,
    title: json.title,
    detail: json.detail,
    type: json.type,
    errors: json.errors,
    body: raw.slice(0, 1000),
  });
  if (res.status === 403 && /duplicate/i.test(raw)) return { ok: false, error: "X says this is a duplicate post" };
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "X rejected the credentials or the app lacks Read and Write permission" };
  }
  if (res.status === 429) return { ok: false, error: "X rate limit, try again later" };
  return { ok: false, error: `X could not publish the post (HTTP ${res.status})` };
}

export const xAdapter: PublishAdapter = {
  platform: "x",
  isConfigured: () => credentials() !== null,
  async publish(text): Promise<PublishResult> {
    const creds = credentials();
    if (!creds) return { status: "awaiting_user_action", openUrl: xIntentUrl(text) };
    const parts = splitXThread(text);
    if (!parts.length) return { status: "failed", error: "The post is empty" };
    const tooLong = parts.findIndex((p) => xLength(p) > MAX_CHARS);
    if (tooLong >= 0) {
      return {
        status: "failed",
        error: parts.length > 1 ? `Post ${tooLong + 1} is over ${MAX_CHARS} characters` : `The post is over ${MAX_CHARS} characters`,
      };
    }
    const ids: string[] = [];
    for (const part of parts) {
      const body = ids.length ? { text: part, reply: { in_reply_to_tweet_id: ids[ids.length - 1] } } : { text: part };
      const res = await postTweet(creds, body);
      if (!res.ok) {
        if (!ids.length) return { status: "failed", error: res.error };
        return {
          status: "published",
          externalPostId: ids[0],
          url: `https://x.com/i/status/${ids[0]}`,
          externalPostIds: ids,
          partialError: `Posted ${ids.length} of ${parts.length} thread posts: ${res.error}`,
        };
      }
      ids.push(res.id);
    }
    return { status: "published", externalPostId: ids[0], url: `https://x.com/i/status/${ids[0]}`, externalPostIds: ids };
  },
};
