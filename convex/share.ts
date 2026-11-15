import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { httpAction, internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { detectSourcePlatform, LIMITS } from "../src/shared/contracts";
import { logEvent } from "./activity";
import { requireUser } from "./lib/auth";
import { rateLimiter } from "./lib/rateLimits";
import { vOwnerId } from "./lib/validators";

// OWNER: Share to Zapy (CONS-22). POST /save lets an iOS Shortcut save anything from the
// share sheet with a per-user bearer token. Saves follow the same rules as items.create
// and go through internal.ingest.run, so links, text, and images analyze the same way.

export const MAX_SHARE_IMAGE_BYTES = 8 * 1024 * 1024;

function newToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "zapy_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function setNewToken(ctx: MutationCtx, user: Doc<"users">): Promise<string> {
  const shareToken = newToken();
  await ctx.db.patch("users", user._id, { shareToken });
  return shareToken;
}

/** The device owner's share token, created on first call. */
export const getOrCreateShareToken = mutation({
  args: { ownerId: vOwnerId },
  returns: v.string(),
  handler: async (ctx, { ownerId }) => {
    const user = await requireUser(ctx, ownerId);
    return user.shareToken ?? (await setNewToken(ctx, user));
  },
});

/** Replaces the share token; the old one stops working immediately. */
export const rotateShareToken = mutation({
  args: { ownerId: vOwnerId },
  returns: v.string(),
  handler: async (ctx, { ownerId }) => {
    const user = await requireUser(ctx, ownerId);
    return await setNewToken(ctx, user);
  },
});

/** Resolves a token to its user and counts one request against the per-minute limit. */
export const authorize = internalMutation({
  args: { token: v.string() },
  returns: v.union(
    v.object({ status: v.literal("ok"), userId: v.id("users") }),
    v.object({ status: v.literal("unauthorized") }),
    v.object({ status: v.literal("rate_limited") }),
  ),
  handler: async (ctx, { token }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", token))
      .unique();
    if (!user) return { status: "unauthorized" as const };
    const { ok } = await rateLimiter.limit(ctx, "shareSave", { key: user._id });
    if (!ok) return { status: "rate_limited" as const };
    return { status: "ok" as const, userId: user._id };
  },
});

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length > LIMITS.urlMaxChars) throw new ConvexError("URL is too long");
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (!/^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test(withScheme)) throw new ConvexError("That doesn't look like a valid link");
  return withScheme;
}

/** Same validation, row shape, activity event, and ingest scheduling as items.create. */
export const createFromShare = internalMutation({
  args: {
    userId: v.id("users"),
    sourceUrl: v.optional(v.string()),
    rawText: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
  },
  returns: v.id("savedItems"),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) throw new ConvexError("Unknown owner");
    let rawText = args.rawText?.trim() || undefined;
    let urlInput = args.sourceUrl?.trim() || undefined;
    if (!urlInput && rawText && /^https?:\/\/\S+$/i.test(rawText)) {
      urlInput = rawText;
      rawText = undefined;
    }
    const sourceUrl = urlInput ? normalizeUrl(urlInput) : undefined;
    if (rawText && rawText.length > LIMITS.rawTextMaxChars) throw new ConvexError("Text is too long");
    if (!sourceUrl && !rawText && !args.imageStorageId) throw new ConvexError("Add a link, some text, or an image");
    if (args.imageStorageId && !(await ctx.db.system.get("_storage", args.imageStorageId))) {
      throw new ConvexError("Upload not found");
    }
    const now = Date.now();
    const itemId = await ctx.db.insert("savedItems", {
      userId: user._id,
      sourceKind: args.imageStorageId ? "image" : sourceUrl ? "url" : "text",
      sourceUrl,
      sourcePlatform: sourceUrl ? detectSourcePlatform(sourceUrl) : "manual",
      rawText,
      imageStorageId: args.imageStorageId,
      contentTypes: [],
      extractionStatus: "pending",
      searchText: [sourceUrl, rawText?.slice(0, 4000)].filter(Boolean).join(" ").toLowerCase(),
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, user._id, { type: "item_saved", title: "Saved", detail: sourceUrl ?? rawText?.slice(0, 80) ?? "Image", itemId });
    await ctx.scheduler.runAfter(0, internal.ingest.run, { itemId });
    return itemId;
  },
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function errorText(error: unknown): string {
  if (error instanceof ConvexError) return typeof error.data === "string" ? error.data : "Couldn't save that";
  return "Couldn't save that";
}

/** POST /save. Bearer share token; JSON { url?, text? }, text/plain, or a raw image/* body (max 8 MB). */
export const save = httpAction(async (ctx, req) => {
  const token = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!token) return json({ error: "Missing share token" }, 401);
  const auth = await ctx.runMutation(internal.share.authorize, { token });
  if (auth.status === "unauthorized") return json({ error: "Unknown share token" }, 401);
  if (auth.status === "rate_limited") return json({ error: "Too many saves. Try again in a minute." }, 429);
  const userId: Id<"users"> = auth.userId;

  const contentType = (req.headers.get("Content-Type") ?? "").split(";")[0]!.trim().toLowerCase();
  let args: { sourceUrl?: string; rawText?: string; imageStorageId?: Id<"_storage"> };
  if (contentType.startsWith("image/")) {
    if (Number(req.headers.get("Content-Length") ?? 0) > MAX_SHARE_IMAGE_BYTES) return json({ error: "Image is larger than 8 MB" }, 413);
    const blob = await req.blob();
    if (blob.size > MAX_SHARE_IMAGE_BYTES) return json({ error: "Image is larger than 8 MB" }, 413);
    if (blob.size === 0) return json({ error: "Image is empty" }, 400);
    args = { imageStorageId: await ctx.storage.store(new Blob([blob], { type: contentType })) };
  } else if (contentType === "application/json") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Body is not valid JSON" }, 400);
    }
    const { url, text } = (body ?? {}) as { url?: unknown; text?: unknown };
    if ((url !== undefined && typeof url !== "string") || (text !== undefined && typeof text !== "string")) {
      return json({ error: "url and text must be strings" }, 400);
    }
    args = { sourceUrl: url, rawText: text };
  } else if (contentType === "text/plain" || contentType === "") {
    args = { rawText: await req.text() };
  } else {
    return json({ error: "Send JSON { url, text }, plain text, or an image" }, 415);
  }

  try {
    const itemId = await ctx.runMutation(internal.share.createFromShare, { userId, ...args });
    return json({ ok: true, itemId }, 200);
  } catch (error) {
    if (args.imageStorageId) await ctx.storage.delete(args.imageStorageId);
    return json({ error: errorText(error) }, 400);
  }
});
