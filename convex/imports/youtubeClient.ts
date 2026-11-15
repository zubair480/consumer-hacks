// OWNER: YouTube import thread (ZUB-20). Google OAuth 2.0 (web flow, PKCE) and the YouTube Data API v3
// liked-videos list. Pure fetch code with no Convex imports, so it is unit-tested with a mocked
// fetch. Tokens never leave the server.

export const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
export const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const GOOGLE_CALLBACK_PATH = "/oauth/google/callback";

export type GoogleCredentials = { clientId: string; clientSecret: string };

export type GoogleTokens = { accessToken: string; refreshToken?: string; expiresAt: number; scope?: string };

export type ImportedYouTubeVideo = {
  platform: "youtube";
  externalId: string;
  url: string;
  text: string;
  author?: string;
  savedAt?: number;
  imageUrl?: string;
};

const DESCRIPTION_MAX_CHARS = 3000;

/** Reads GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET from the Convex env; null when YouTube import is not configured. */
export function googleCredentials(): GoogleCredentials | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function googleRedirectUri(): string {
  const site = process.env.CONVEX_SITE_URL;
  if (!site) throw new Error("CONVEX_SITE_URL is not set");
  return site.replace(/\/$/, "") + GOOGLE_CALLBACK_PATH;
}

export function buildGoogleAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: YOUTUBE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${GOOGLE_AUTHORIZE_URL}?${params}`;
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function failure(res: Response, what: string): Promise<GoogleApiError> {
  const body = await res.text().catch(() => "");
  let detail = body.slice(0, 200);
  let reason: string | undefined;
  try {
    const json = JSON.parse(body) as {
      error?: string | { message?: string; errors?: { reason?: string }[] };
      error_description?: string;
    };
    if (typeof json.error === "string") {
      reason = json.error;
      detail = json.error_description ?? json.error;
    } else if (json.error) {
      reason = json.error.errors?.[0]?.reason;
      detail = json.error.message ?? detail;
    }
  } catch {
    // keep the raw text
  }
  if (reason === "invalid_grant" || res.status === 401) return new GoogleApiError("YouTube access expired or was revoked. Reconnect YouTube.", 401);
  if (reason === "quotaExceeded" || reason === "rateLimitExceeded" || res.status === 429) {
    return new GoogleApiError("YouTube API quota reached. Try again later.", 429);
  }
  if (reason === "accessNotConfigured") return new GoogleApiError("The YouTube Data API v3 is not enabled for this Google Cloud project.", res.status);
  return new GoogleApiError(`${what} failed (${res.status}): ${detail}`, res.status);
}

async function tokenRequest(fields: Record<string, string>, creds: GoogleCredentials): Promise<GoogleTokens> {
  const body = new URLSearchParams({ ...fields, client_id: creds.clientId, client_secret: creds.clientSecret });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw await failure(res, "Google token request");
  const json = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
  if (!json.access_token) throw new GoogleApiError("Google token response had no access_token", 502);
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    scope: json.scope,
  };
}

export function exchangeGoogleCode(input: { code: string; codeVerifier: string; redirectUri: string }, creds: GoogleCredentials): Promise<GoogleTokens> {
  return tokenRequest(
    { grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri, code_verifier: input.codeVerifier },
    creds,
  );
}

/** Google does not rotate refresh tokens, so the result usually has no refreshToken; keep the old one. */
export function refreshGoogleTokens(refreshToken: string, creds: GoogleCredentials): Promise<GoogleTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, creds);
}

/** The signed-in user's own channel, or null when the Google account has no YouTube channel. */
export async function fetchMyChannel(accessToken: string): Promise<{ id: string; title: string } | null> {
  const res = await fetch(`${YOUTUBE_API}/channels?part=snippet&mine=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw await failure(res, "YouTube channels");
  const json = (await res.json()) as { items?: { id: string; snippet?: { title?: string } }[] };
  const channel = json.items?.[0];
  return channel ? { id: channel.id, title: channel.snippet?.title ?? "" } : null;
}

type Thumbnail = { url?: string };
type YouTubeVideo = {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: Partial<Record<"default" | "medium" | "high" | "standard" | "maxres", Thumbnail>>;
  };
};
export type YouTubeVideosResponse = { items?: YouTubeVideo[]; nextPageToken?: string };

/** Turns one liked-videos page into importable posts plus the next page token. */
export function parseLikedVideos(json: YouTubeVideosResponse): { videos: ImportedYouTubeVideo[]; nextPageToken?: string } {
  const videos = (json.items ?? [])
    .filter((video) => video.id)
    .map((video): ImportedYouTubeVideo => {
      const s = video.snippet ?? {};
      const title = s.title?.trim() || "Untitled video";
      const description = s.description?.trim().slice(0, DESCRIPTION_MAX_CHARS);
      const thumbs = s.thumbnails ?? {};
      const imageUrl = (thumbs.high ?? thumbs.medium ?? thumbs.standard ?? thumbs.default ?? thumbs.maxres)?.url;
      return {
        platform: "youtube",
        externalId: video.id,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        text: [title, s.channelTitle ? `Channel: ${s.channelTitle}` : null, description || null].filter(Boolean).join("\n\n"),
        author: s.channelTitle || undefined,
        imageUrl,
      };
    });
  return { videos, nextPageToken: json.nextPageToken };
}

export async function fetchLikedVideosPage(accessToken: string, maxResults: number, pageToken?: string): Promise<{ videos: ImportedYouTubeVideo[]; nextPageToken?: string }> {
  const params = new URLSearchParams({ myRating: "like", part: "snippet", maxResults: String(maxResults) });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(`${YOUTUBE_API}/videos?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw await failure(res, "YouTube liked videos");
  return parseLikedVideos((await res.json()) as YouTubeVideosResponse);
}
