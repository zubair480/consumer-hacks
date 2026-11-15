/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as analysis from "../analysis.js";
import type * as collections from "../collections.js";
import type * as ingest from "../ingest.js";
import type * as items from "../items.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_sources from "../lib/sources.js";
import type * as lib_validators from "../lib/validators.js";
import type * as preferences from "../preferences.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  analysis: typeof analysis;
  collections: typeof collections;
  ingest: typeof ingest;
  items: typeof items;
  "lib/auth": typeof lib_auth;
  "lib/llm": typeof lib_llm;
  "lib/sources": typeof lib_sources;
  "lib/validators": typeof lib_validators;
  preferences: typeof preferences;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
