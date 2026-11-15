import type { SocialPlatform } from "../../src/shared/socialContracts";

// OWNER: Thread J (CONS-11). Publishing adapter interface.

export type PublishResult =
  | { status: "published"; externalPostId: string; url: string; externalPostIds: string[]; partialError?: string }
  | { status: "awaiting_user_action"; openUrl?: string }
  | { status: "failed"; error: string };

export type PublishOptions = { sourceUrl?: string; imageUrl?: string };

export type AccountPlatform = SocialPlatform | "youtube";

export type PublishAdapter = {
  platform: AccountPlatform;
  /** True when every env var the adapter needs is set. Never exposes values. */
  isConfigured(): boolean;
  publish(text: string, opts: PublishOptions): Promise<PublishResult>;
};
