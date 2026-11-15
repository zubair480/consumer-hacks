import type { PublishAdapter, PublishOptions, PublishResult } from "./types";

// OWNER: Instagram thread (CONS-16). "Instagram API with Instagram Login" on graph.instagram.com:
// create a media container, poll it until FINISHED, publish it, then read its permalink.
// Credentials live only in Convex env; nothing here is returned to the client.

const GRAPH = "https://graph.instagram.com/v27.0";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

export const INSTAGRAM_ERRORS = {
  tokenExpired: "Instagram token expired, reconnect",
  imageRejected: "Instagram couldn't process the image",
  generic: "Instagram couldn't publish the post, try again",
  timeout: "Instagram is still processing the image, try again in a minute",
} as const;

export type InstagramDeps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

const defaultDeps: InstagramDeps = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

class InstagramError extends Error {}

type GraphError = { error?: { code?: number; type?: string; message?: string } };

async function graph<T>(
  deps: InstagramDeps,
  token: string,
  step: string,
  path: string,
  body?: Record<string, string>,
): Promise<T> {
  const res = await deps.fetch(GRAPH + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let json: T & GraphError;
  try {
    json = JSON.parse(raw) as T & GraphError;
  } catch {
    json = {} as T & GraphError;
  }
  if (res.ok && !json.error) return json;
  console.error(`Instagram ${step} failed: HTTP ${res.status} ${raw.slice(0, 1000)}`);
  if (json.error?.code === 190) throw new InstagramError(INSTAGRAM_ERRORS.tokenExpired);
  throw new InstagramError(INSTAGRAM_ERRORS.generic);
}

async function userId(deps: InstagramDeps, token: string): Promise<string> {
  if (process.env.INSTAGRAM_USER_ID) return process.env.INSTAGRAM_USER_ID;
  const me = await graph<{ user_id?: string; id?: string }>(deps, token, "GET /me", "/me?fields=user_id,username");
  const id = me.user_id ?? me.id;
  if (!id) throw new InstagramError(INSTAGRAM_ERRORS.generic);
  return id;
}

async function waitUntilFinished(deps: InstagramDeps, token: string, containerId: string): Promise<void> {
  const deadline = deps.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const { status_code } = await graph<{ status_code?: string }>(
      deps,
      token,
      "GET container status",
      `/${containerId}?fields=status_code`,
    );
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      console.error(`Instagram container ${containerId} status ${status_code}`);
      throw new InstagramError(INSTAGRAM_ERRORS.imageRejected);
    }
    if (deps.now() + POLL_INTERVAL_MS > deadline) throw new InstagramError(INSTAGRAM_ERRORS.timeout);
    await deps.sleep(POLL_INTERVAL_MS);
  }
}

export async function publishToInstagram(
  caption: string,
  opts: PublishOptions & { imageUrl?: string },
  deps: InstagramDeps = defaultDeps,
): Promise<PublishResult> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token || !opts.imageUrl) return { status: "awaiting_user_action" };
  try {
    const igUserId = await userId(deps, token);
    const container = await graph<{ id?: string }>(deps, token, "POST /media", `/${igUserId}/media`, {
      image_url: opts.imageUrl,
      caption,
    });
    if (!container.id) throw new InstagramError(INSTAGRAM_ERRORS.generic);
    await waitUntilFinished(deps, token, container.id);
    const media = await graph<{ id?: string }>(deps, token, "POST /media_publish", `/${igUserId}/media_publish`, {
      creation_id: container.id,
    });
    if (!media.id) throw new InstagramError(INSTAGRAM_ERRORS.generic);
    let url = `https://www.instagram.com/`;
    try {
      const { permalink } = await graph<{ permalink?: string }>(deps, token, "GET permalink", `/${media.id}?fields=permalink`);
      if (permalink) url = permalink;
    } catch (e) {
      console.error("Instagram permalink lookup failed after publishing", e);
    }
    return { status: "published", externalPostId: media.id, url, externalPostIds: [media.id] };
  } catch (e) {
    if (e instanceof InstagramError) return { status: "failed", error: e.message };
    console.error("Instagram publish failed", e);
    return { status: "failed", error: INSTAGRAM_ERRORS.generic };
  }
}

export const instagramAdapter: PublishAdapter = {
  platform: "instagram",
  isConfigured: () => !!process.env.INSTAGRAM_ACCESS_TOKEN,
  publish: (caption, opts) => publishToInstagram(caption, opts),
};
