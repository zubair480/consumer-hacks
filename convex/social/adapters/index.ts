import type { SocialPlatform } from "../../../src/shared/socialContracts";
import { instagram } from "./instagram";
import { linkedin } from "./linkedin";
import { threads } from "./threads";
import { tiktok } from "./tiktok";
import type { PlatformAdapter } from "./types";
import { x } from "./x";

// OWNER: Thread H+I.
export const ADAPTERS: Record<SocialPlatform, PlatformAdapter> = { linkedin, x, instagram, tiktok, threads };
