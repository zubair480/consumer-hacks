import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

/** Shared pool for background jobs (cron auto-sync, embeddings) so bursts never exceed 5 concurrent runs. */
export const backgroundPool = new Workpool(components.backgroundPool, { maxParallelism: 5 });
