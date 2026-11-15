import type { AccountPlatform, PublishAdapter } from "./types";
import { instagramAdapter } from "./instagram";
import { linkedinAdapter } from "./linkedin";
import { xAdapter } from "./x";

// OWNER: Thread J (CONS-11). Adapter registry. Platforms without an adapter use copy + share sheet.

export const ADAPTERS: Partial<Record<AccountPlatform, PublishAdapter>> = { x: xAdapter, linkedin: linkedinAdapter, instagram: instagramAdapter };

export const ACCOUNT_PLATFORMS: AccountPlatform[] = ["x", "linkedin", "instagram", "tiktok", "youtube"];
