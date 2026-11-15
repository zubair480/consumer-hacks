/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as activity from "../activity.js";
import type * as analysis from "../analysis.js";
import type * as collections from "../collections.js";
import type * as ingest from "../ingest.js";
import type * as items from "../items.js";
import type * as lib_actionCatalog from "../lib/actionCatalog.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_executors_document from "../lib/executors/document.js";
import type * as lib_executors_generic from "../lib/executors/generic.js";
import type * as lib_executors_github from "../lib/executors/github.js";
import type * as lib_executors_graphic from "../lib/executors/graphic.js";
import type * as lib_executors_index from "../lib/executors/index.js";
import type * as lib_executors_openai from "../lib/executors/openai.js";
import type * as lib_executors_restaurant from "../lib/executors/restaurant.js";
import type * as lib_executors_scholarship from "../lib/executors/scholarship.js";
import type * as lib_executors_sources from "../lib/executors/sources.js";
import type * as lib_executors_types from "../lib/executors/types.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_sources from "../lib/sources.js";
import type * as lib_validators from "../lib/validators.js";
import type * as media from "../media.js";
import type * as preferences from "../preferences.js";
import type * as publishing_index from "../publishing/index.js";
import type * as publishing_jobs from "../publishing/jobs.js";
import type * as publishing_linkedin from "../publishing/linkedin.js";
import type * as publishing_testPost from "../publishing/testPost.js";
import type * as publishing_types from "../publishing/types.js";
import type * as publishing_x from "../publishing/x.js";
import type * as social_adapters_index from "../social/adapters/index.js";
import type * as social_adapters_instagram from "../social/adapters/instagram.js";
import type * as social_adapters_linkedin from "../social/adapters/linkedin.js";
import type * as social_adapters_threads from "../social/adapters/threads.js";
import type * as social_adapters_tiktok from "../social/adapters/tiktok.js";
import type * as social_adapters_types from "../social/adapters/types.js";
import type * as social_adapters_x from "../social/adapters/x.js";
import type * as social_composer from "../social/composer.js";
import type * as social_drafts from "../social/drafts.js";
import type * as social_validators from "../social/validators.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  actions: typeof actions;
  activity: typeof activity;
  analysis: typeof analysis;
  collections: typeof collections;
  ingest: typeof ingest;
  items: typeof items;
  "lib/actionCatalog": typeof lib_actionCatalog;
  "lib/auth": typeof lib_auth;
  "lib/executors/document": typeof lib_executors_document;
  "lib/executors/generic": typeof lib_executors_generic;
  "lib/executors/github": typeof lib_executors_github;
  "lib/executors/graphic": typeof lib_executors_graphic;
  "lib/executors/index": typeof lib_executors_index;
  "lib/executors/openai": typeof lib_executors_openai;
  "lib/executors/restaurant": typeof lib_executors_restaurant;
  "lib/executors/scholarship": typeof lib_executors_scholarship;
  "lib/executors/sources": typeof lib_executors_sources;
  "lib/executors/types": typeof lib_executors_types;
  "lib/llm": typeof lib_llm;
  "lib/sources": typeof lib_sources;
  "lib/validators": typeof lib_validators;
  media: typeof media;
  preferences: typeof preferences;
  "publishing/index": typeof publishing_index;
  "publishing/jobs": typeof publishing_jobs;
  "publishing/linkedin": typeof publishing_linkedin;
  "publishing/testPost": typeof publishing_testPost;
  "publishing/types": typeof publishing_types;
  "publishing/x": typeof publishing_x;
  "social/adapters/index": typeof social_adapters_index;
  "social/adapters/instagram": typeof social_adapters_instagram;
  "social/adapters/linkedin": typeof social_adapters_linkedin;
  "social/adapters/threads": typeof social_adapters_threads;
  "social/adapters/tiktok": typeof social_adapters_tiktok;
  "social/adapters/types": typeof social_adapters_types;
  "social/adapters/x": typeof social_adapters_x;
  "social/composer": typeof social_composer;
  "social/drafts": typeof social_drafts;
  "social/validators": typeof social_validators;
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
