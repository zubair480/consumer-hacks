import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalQuery } from "../_generated/server";
import { requireUser } from "../lib/auth";
import { vOwnerId } from "../lib/validators";
import { ADAPTERS } from "./index";
import type { PublishAdapter, PublishResult } from "./types";

// OWNER: Thread A (CONS-4). Profile → Connected accounts → "Send test post".
// Posts a fixed, URL-free line so the demo can prove live posting without drafting.
// No publishingJobs row: that table requires a draftId and a test post has no draft.

const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

/** The exact text the confirm sheet shows and the action posts. */
export function testPostText(localTime: string): string {
  if (!LOCAL_TIME.test(localTime)) throw new ConvexError("Invalid time");
  return `Testing AfterScroll ${localTime}`;
}

/** Runs one test post through an adapter. Never reports published without a provider post id. */
export async function runTestPost(adapter: PublishAdapter | undefined, text: string): Promise<PublishResult> {
  if (!adapter || !adapter.isConfigured()) return { status: "failed", error: "This account is not connected." };
  let result: PublishResult;
  try {
    result = await adapter.publish(text, {});
  } catch (e) {
    console.error("test post adapter threw", e);
    return { status: "failed", error: "Could not reach the platform. Try again." };
  }
  if (result.status === "awaiting_user_action") return { status: "failed", error: "This account is not connected." };
  if (result.status === "published" && !result.externalPostId) {
    return { status: "failed", error: "The platform did not return a post id." };
  }
  return result;
}

export const checkOwner = internalQuery({
  args: { ownerId: vOwnerId },
  handler: async (ctx, { ownerId }) => {
    await requireUser(ctx, ownerId);
    return null;
  },
});

export const sendTestPost = action({
  args: {
    ownerId: vOwnerId,
    platform: v.union(v.literal("x"), v.literal("linkedin")),
    localTime: v.string(),
  },
  handler: async (ctx, { ownerId, platform, localTime }): Promise<PublishResult> => {
    await ctx.runQuery(internal.publishing.testPost.checkOwner, { ownerId });
    return await runTestPost(ADAPTERS[platform], testPostText(localTime));
  },
});
