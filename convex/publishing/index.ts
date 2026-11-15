import type { AccountPlatform, PublishAdapter } from "./types";
import { xAdapter } from "./x";

// OWNER: Thread J (CONS-11). Adapter registry. Platforms without an adapter use copy + share sheet.

export const ADAPTERS: Partial<Record<AccountPlatform, PublishAdapter>> = { x: xAdapter };

export const ACCOUNT_PLATFORMS: AccountPlatform[] = ["x", "linkedin", "instagram", "tiktok", "youtube"];
