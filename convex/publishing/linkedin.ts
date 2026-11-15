import type { PublishAdapter, PublishResult } from "./types";

const LINKEDIN_VERSION = "202610";
const POSTS_URL = "https://api.linkedin.com/rest/posts";
const UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

let cachedPersonUrn: string | undefined;

export function escapeLittleText(text: string): string {
  return text.replace(/[()[\]{}<>@|~_*#\\]/g, "\\$&");
}

export function linkedInPostUrl(urn: string): string {
  return `https://www.linkedin.com/feed/update/${urn}/`;
}

export function linkedInShareOffsiteUrl(sourceUrl?: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(sourceUrl ?? "")}`;
}

function errorFor(status: number): string {
  if (status === 401) return "LinkedIn token expired or invalid, reconnect";
  if (status === 403) return "LinkedIn app is missing the Share on LinkedIn product";
  if (status === 429) return "LinkedIn rate limit (150 posts/day)";
  return `LinkedIn post failed (HTTP ${status})`;
}

function isVersionError(status: number, body: string): boolean {
  if (status === 401 || status === 403 || status === 429) return false;
  return /version/i.test(body);
}

async function personUrn(token: string): Promise<string | { error: string }> {
  const fromEnv = process.env.LINKEDIN_PERSON_URN;
  if (fromEnv) return fromEnv;
  if (cachedPersonUrn) return cachedPersonUrn;
  const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error("LinkedIn userinfo failed", res.status, await res.text());
    return { error: errorFor(res.status) };
  }
  const { sub } = (await res.json()) as { sub?: string };
  if (!sub) return { error: "LinkedIn did not return a member id" };
  cachedPersonUrn = `urn:li:person:${sub}`;
  return cachedPersonUrn;
}

function published(res: Response): PublishResult {
  const urn = res.headers.get("x-restli-id");
  if (!urn) return { status: "failed", error: "LinkedIn did not return a post id" };
  return { status: "published", externalPostId: urn, externalPostIds: [urn], url: linkedInPostUrl(urn) };
}

export const linkedinAdapter: PublishAdapter = {
  platform: "linkedin",

  isConfigured(): boolean {
    return Boolean(process.env.LINKEDIN_ACCESS_TOKEN);
  },

  async publish(text, opts) {
    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    if (!token) return { status: "awaiting_user_action", openUrl: linkedInShareOffsiteUrl(opts.sourceUrl) };

    const author = await personUrn(token);
    if (typeof author !== "string") return { status: "failed", error: author.error };

    const commentary = escapeLittleText(text);
    const res = await fetch(POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Linkedin-Version": LINKEDIN_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        author,
        commentary,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    if (res.status === 201) return published(res);

    const body = await res.text();
    console.error("LinkedIn /rest/posts failed", res.status, body);
    if (!isVersionError(res.status, body)) return { status: "failed", error: errorFor(res.status) };

    const legacy = await fetch(UGC_POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (legacy.status === 201) return published(legacy);
    console.error("LinkedIn /v2/ugcPosts failed", legacy.status, await legacy.text());
    return { status: "failed", error: errorFor(legacy.status) };
  },
};
