import { MINUTE, RateLimiter, SECOND } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";

export const SHARE_RATE_LIMIT = 30;
export const IMPORT_SYNC_PERIOD_MS = 30 * SECOND;

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  shareSave: { kind: "fixed window", rate: SHARE_RATE_LIMIT, period: MINUTE },
  importSync: { kind: "fixed window", rate: 1, period: IMPORT_SYNC_PERIOD_MS },
});

/** One manual sync per platform per owner every 30 s; throws a readable error otherwise. */
export async function requireSyncSlot(ctx: ActionCtx, userId: Id<"users">, platform: "github" | "youtube" | "x") {
  const { ok, retryAfter } = await rateLimiter.limit(ctx, "importSync", { key: `${userId}:${platform}` });
  if (!ok) throw new ConvexError(`Synced moments ago. Try again in ${Math.max(1, Math.ceil(retryAfter / 1000))} s.`);
}
