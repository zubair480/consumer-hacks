import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { ensureUser, requireOwned, requireUser } from "./lib/auth";
import { callLLMJson } from "./lib/llm";
import { imageToDataUrl } from "./lib/sources";
import { vOwnerId } from "./lib/validators";
import { vMediaAnalysis } from "./social/validators";
import type { MediaAnalysis } from "../src/shared/socialContracts";

// OWNER: Photo flow (CONS-13). Upload, store, and describe a new photo for Social Studio entry point B.

const MAX_CONTEXT = 500;

async function withUrl(ctx: QueryCtx, asset: Doc<"mediaAssets">) {
  return { ...asset, url: await ctx.storage.getUrl(asset.storageId) };
}

export const generateUploadUrl = mutation({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    await ensureUser(ctx, ownerId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createMediaAsset = mutation({
  args: { ownerId: vOwnerId, storageId: v.id("_storage"), context: v.optional(v.string()) },
  handler: async (ctx, { ownerId, storageId, context }) => {
    const user = await ensureUser(ctx, ownerId);
    const meta = await ctx.db.system.get(storageId);
    if (!meta) throw new ConvexError("Upload not found");
    if (meta.contentType && !meta.contentType.startsWith("image/")) throw new ConvexError("Only photos are supported");
    const trimmed = context?.trim().slice(0, MAX_CONTEXT);
    return await ctx.db.insert("mediaAssets", {
      userId: user._id,
      storageId,
      kind: "photo",
      context: trimmed || undefined,
      createdAt: Date.now(),
    });
  },
});

export const setContext = mutation({
  args: { ownerId: vOwnerId, mediaId: v.id("mediaAssets"), context: v.string() },
  handler: async (ctx, { ownerId, mediaId, context }) => {
    const user = await requireUser(ctx, ownerId);
    await requireOwned(ctx, user, mediaId);
    await ctx.db.patch(mediaId, { context: context.trim().slice(0, MAX_CONTEXT) || undefined });
  },
});

export const get = query({
  args: { ownerId: vOwnerId, mediaId: v.id("mediaAssets") },
  handler: async (ctx, { ownerId, mediaId }) => {
    const user = await requireUser(ctx, ownerId);
    return await withUrl(ctx, await requireOwned(ctx, user, mediaId));
  },
});

export const list = query({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    const user = await requireUser(ctx, ownerId);
    const assets = await ctx.db
      .query("mediaAssets")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
    return await Promise.all(assets.map((a) => withUrl(ctx, a)));
  },
});

export const getForAnalysis = internalQuery({
  args: { ownerId: vOwnerId, mediaId: v.id("mediaAssets") },
  handler: async (ctx, { ownerId, mediaId }) => {
    const user = await requireUser(ctx, ownerId);
    return await withUrl(ctx, await requireOwned(ctx, user, mediaId));
  },
});

export const saveAnalysis = internalMutation({
  args: { mediaId: v.id("mediaAssets"), analysis: vMediaAnalysis },
  handler: async (ctx, { mediaId, analysis }) => {
    await ctx.db.patch(mediaId, { analysis });
  },
});

type RawAnalysis = { summary?: unknown; subjects?: unknown; setting?: unknown; mood?: unknown; textInImage?: unknown };

const strings = (value: unknown, max: number) =>
  Array.isArray(value) ? value.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim()).slice(0, max) : [];
const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Describes what is visibly in the photo. Names, places, and brands appear only when the user's context or legible text supplies them. */
export const analyzeMedia = action({
  args: { ownerId: vOwnerId, mediaId: v.id("mediaAssets") },
  handler: async (ctx, { ownerId, mediaId }): Promise<MediaAnalysis> => {
    const asset: { context?: string; url: string | null } = await ctx.runQuery(internal.media.getForAnalysis, { ownerId, mediaId });
    if (!asset.url) throw new ConvexError("Photo file is missing");
    const raw = await callLLMJson<RawAnalysis>({
      system: [
        "You describe a user's photo so a social post can be written about it.",
        "Describe only what is visible. Never invent names of people, businesses, places, cities, brands, or events.",
        "Name a place or brand only if it is legible in the photo or stated in the user's context, and never claim the user did, ate, built, or experienced anything the context does not say.",
        "Keep each field short and concrete.",
      ].join(" "),
      user: asset.context ? `User's context: ${asset.context}` : "The user gave no context.",
      images: [await imageToDataUrl(asset.url)],
      schemaHint: '{ "summary": "one sentence describing the photo", "subjects": ["main things in the photo"], "setting": "indoor/outdoor and kind of place", "mood": "a few words", "textInImage": "text legible in the photo, or empty string" }',
      maxOutputTokens: 600,
    });
    const opt = (value: unknown) => str(value) || undefined;
    const analysis = {
      summary: str(raw.summary) || "A photo",
      subjects: strings(raw.subjects, 8),
      setting: opt(raw.setting),
      mood: opt(raw.mood),
      textInImage: opt(raw.textInImage),
    };
    await ctx.runMutation(internal.media.saveAnalysis, { mediaId, analysis });
    return analysis;
  },
});
