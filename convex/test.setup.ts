/// <reference types="vite/client" />
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import workpoolTest from "@convex-dev/workpool/test";
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";

// Module map for convex-test. Files with more than one dot are not deployed by Convex.
export const modules = import.meta.glob("./**/*.*s");

/** Registers the components from convex.config.ts on a convex-test instance. */
export function registerComponents<T extends TestConvex<SchemaDefinition<GenericSchema, boolean>>>(t: T): T {
  rateLimiterTest.register(t);
  workpoolTest.register(t, "backgroundPool");
  return t;
}
