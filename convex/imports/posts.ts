import { v, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { internalAction, internalMutation, mutation, type MutationCtx } from "../_generated/server";
import { LIMITS } from "../../src/shared/contracts";
import { logEvent } from "../activity";
import { requireUser } from "../lib/auth";
import { vOwnerId } from "../lib/validators";
import { vImportPlatform } from "./schema";

// OWNER: Import thread (CONS-19). Source-agnostic import: any connector (X sync, a future
// Instagram/LinkedIn path, a client-side importer) hands posts here. Each new post becomes a
// savedItem with its text already filled in, so login-walled posts still analyze, and goes
// through the normal internal.ingest.run pipeline.

export const MAX_IMPORT_BATCH = 100;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const vImportedPost = v.object({
  platform: vImportPlatform,
  /** The platform's own post id; derived from the URL when omitted. */
  externalId: v.optional(v.string()),
  url: v.string(),
  text: v.string(),
  author: v.optional(v.string()),
  savedAt: v.optional(v.number()),
  imageUrl: v.optional(v.string()),
});
export type ImportedPost = Infer<typeof vImportedPost>;

export const vImportResult = v.object({ created: v.number(), duplicates: v.number(), invalid: v.number() });
export type ImportResult = Infer<typeof vImportResult>;

const PLATFORM_LABELS: Record<ImportedPost["platform"], string> = { x: "X", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube" };

function cleanUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url || url.length > LIMITS.urlMaxChars || !/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(url)) return null;
  return url;
}

const X_STATUS = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([^/?#]+)\/status(?:es)?\/(\d+)/i;
const YOUTUBE_VIDEO = /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/)|youtu\.be\/)([\w-]{11})/i;

/** The platform id for a post, from the caller or parsed from its URL. */
export function externalIdFor(post: ImportedPost): string | undefined {
  if (post.externalId) return post.externalId;
  if (post.platform === "x") return X_STATUS.exec(post.url)?.[2];
  if (post.platform === "youtube") return YOUTUBE_VIDEO.exec(post.url)?.[1];
  return undefined;
}

/** URL spellings, without query strings, that a user may already have saved by pasting (x.com vs twitter.com). */
export function urlVariants(url: string): string[] {
  const video = YOUTUBE_VIDEO.exec(url)?.[1];
  if (video) {
    const hosts = ["https://www.youtube.com", "https://youtube.com", "https://m.youtube.com"];
    return [...hosts.map((h) => `${h}/watch?v=${video}`), ...hosts.map((h) => `${h}/shorts/${video}`), `https://youtu.be/${video}`];
  }
  const out = new Set([url.split(/[?#]/)[0]!.replace(/\/$/, "")]);
  const x = X_STATUS.exec(url);
  if (x) {
    for (const host of ["x.com", "twitter.com", "www.x.com", "www.twitter.com", "mobile.twitter.com"]) {
      out.add(`https://${host}/${x[1]}/status/${x[2]}`);
    }
  }
  return [...out];
}

function itemText(post: ImportedPost): string {
  const header = post.author ? `Post by ${post.author} on ${PLATFORM_LABELS[post.platform]}` : `Post on ${PLATFORM_LABELS[post.platform]}`;
  return `${header}\n\n${post.text.trim()}`.slice(0, LIMITS.rawTextMaxChars);
}

/**
 * Dedupes and stores posts for one user. Duplicates are posts already imported (same
 * platform id) or already saved by URL, including repeats inside the batch.
 */
export async function importPosts(ctx: MutationCtx, user: Doc<"users">, posts: ImportedPost[]): Promise<ImportResult & { itemIds: Id<"savedItems">[] }> {
  if (posts.length > MAX_IMPORT_BATCH) throw new Error(`Import at most ${MAX_IMPORT_BATCH} posts per batch`);
  const seen = new Set<string>();
  const itemIds: Id<"savedItems">[] = [];
  let duplicates = 0;
  let invalid = 0;

  for (const post of posts) {
    const url = cleanUrl(post.url);
    if (!url) {
      invalid++;
      continue;
    }
    const externalId = externalIdFor(post);
    const key = externalId ? `${post.platform}:${externalId}` : url;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);

    const alreadyImported = externalId
      ? await ctx.db
          .query("importedPosts")
          .withIndex("by_userId_and_platform_and_externalId", (q) =>
            q.eq("userId", user._id).eq("platform", post.platform).eq("externalId", externalId),
          )
          .first()
      : null;
    let alreadySaved = false;
    if (!alreadyImported) {
      for (const candidate of urlVariants(url)) {
        const nearby = await ctx.db
          .query("savedItems")
          .withIndex("by_userId_and_sourceUrl", (q) => q.eq("userId", user._id).gte("sourceUrl", candidate).lt("sourceUrl", candidate + "\uffff"))
          .take(20);
        if (nearby.some((item) => item.sourceUrl === candidate || /^[/?#&]/.test(item.sourceUrl!.slice(candidate.length)))) {
          alreadySaved = true;
          break;
        }
      }
    }
    if (alreadyImported || alreadySaved) {
      duplicates++;
      continue;
    }

    const now = Date.now();
    const rawText = itemText(post);
    const itemId = await ctx.db.insert("savedItems", {
      userId: user._id,
      sourceKind: "url",
      sourceUrl: url,
      sourcePlatform: post.platform,
      rawText,
      contentTypes: [],
      extractionStatus: "pending",
      searchText: [url, rawText.slice(0, 4000)].join(" ").toLowerCase(),
      createdAt: now,
      updatedAt: now,
    });
    if (externalId) {
      await ctx.db.insert("importedPosts", { userId: user._id, platform: post.platform, externalId, itemId, savedAt: post.savedAt, importedAt: now });
    }
    if (post.imageUrl && cleanUrl(post.imageUrl)) {
      await ctx.scheduler.runAfter(0, internal.imports.posts.attachImageThenIngest, { itemId, imageUrl: post.imageUrl });
    } else {
      await ctx.scheduler.runAfter(0, internal.ingest.run, { itemId });
    }
    itemIds.push(itemId);
  }
  return { created: itemIds.length, duplicates, invalid, itemIds };
}

export async function logImport(ctx: MutationCtx, userId: Id<"users">, label: string, result: ImportResult, itemId?: Id<"savedItems">) {
  const parts = [`${result.created} new`, `${result.duplicates} already in Zapy`];
  if (result.invalid) parts.push(`${result.invalid} skipped (no valid link)`);
  await logEvent(ctx, userId, {
    type: "item_saved",
    title: result.created ? `Imported ${result.created} ${result.created === 1 ? "save" : "saves"} from ${label}` : `Nothing new to import from ${label}`,
    detail: parts.join(", "),
    itemId: result.created === 1 ? itemId : undefined,
  });
}

/** Imports a batch of posts for the device owner and reports counts. Logs one activity event. */
export const importBatch = mutation({
  args: { ownerId: vOwnerId, posts: v.array(vImportedPost) },
  returns: vImportResult,
  handler: async (ctx, { ownerId, posts }) => {
    const user = await requireUser(ctx, ownerId);
    const { itemIds, ...result } = await importPosts(ctx, user, posts);
    const platforms = [...new Set(posts.map((p) => PLATFORM_LABELS[p.platform]))];
    await logImport(ctx, user._id, platforms.join(", ") || "import", result, itemIds[0]);
    return result;
  },
});

/** Server-side connectors (X sync) import page by page without logging; they log once at the end. */
export const importForUser = internalMutation({
  args: { userId: v.id("users"), posts: v.array(vImportedPost) },
  returns: vImportResult,
  handler: async (ctx, { userId, posts }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) throw new Error("Unknown user");
    const { itemIds: _itemIds, ...result } = await importPosts(ctx, user, posts);
    return result;
  },
});

export const setImportedImage = internalMutation({
  args: { itemId: v.id("savedItems"), storageId: v.id("_storage") },
  returns: v.boolean(),
  handler: async (ctx, { itemId, storageId }) => {
    const item = await ctx.db.get("savedItems", itemId);
    if (!item || item.imageStorageId) return false;
    await ctx.db.patch("savedItems", itemId, { imageStorageId: storageId, updatedAt: Date.now() });
    return true;
  },
});

/** Copies the post's image into storage so analysis can see it, then runs the normal ingest. */
export const attachImageThenIngest = internalAction({
  args: { itemId: v.id("savedItems"), imageUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, { itemId, imageUrl }) => {
    try {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.startsWith("image/")) {
        const blob = await res.blob();
        if (blob.size <= MAX_IMAGE_BYTES) {
          const storageId = await ctx.storage.store(blob);
          const attached = await ctx.runMutation(internal.imports.posts.setImportedImage, { itemId, storageId });
          if (!attached) await ctx.storage.delete(storageId);
        }
      }
    } catch (error) {
      console.warn("import image fetch failed", itemId, error instanceof Error ? error.message : error);
    }
    await ctx.scheduler.runAfter(0, internal.ingest.run, { itemId });
    return null;
  },
});
