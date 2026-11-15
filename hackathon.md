# Hackathon log

- **Project:** Zapy
- **What it does:** An iPhone app that turns what you save (links, text, screenshots) into actions you can run, such as an application checklist for a scholarship or a setup guide for a GitHub repo, and into social posts drafted from those saves.
- **Live app:** not deployed (runs on iPhone through Expo Go)
- **Repo:** https://github.com/zubair480/consumer-hacks
- **Frontend:** Other (Expo SDK 58 + Expo Router app in Expo Go)
- **Convex deployment:** https://pleasant-lark-678.convex.cloud (shared dev deployment)
- **Components:** none
- **Convex features:** schema, indexes, queries, mutations, actions, internal actions, scheduled functions, file storage, full-text search, HTTP actions
- **Auth:** none (device-scoped ownerId checked on every public function)
- **AI models:** gpt-5.4-mini (set through `OPENAI_MODEL` on the dev deployment)
- **Started:** 2026-11-15T18:38:45Z
- **Last updated:** 2026-11-15T21:56:08Z

## About Zapy

We all save things we never act on: a scholarship, a repo, a restaurant. Zapy reads what you saved, classifies it, pulls out facts with a quote from the source for each one, and offers three actions that fit the content. Running an action produces a result you keep: a checklist, an eligibility check, a setup guide, a visit plan, a design brief. The Create tab turns a save or a new photo into per-platform drafts for LinkedIn, X, Instagram, TikTok and Threads, and posts to LinkedIn or X only after you confirm.

Facts are kept only when their evidence quote appears in the source, and missing facts (a deadline, a price) are reported as missing instead of guessed. See `docs/limitations.md` for what Zapy does not do yet.

## How Zapy uses Convex

All AI work, fetching and publishing run in Convex; the phone only calls queries, mutations and actions. Architecture diagrams are in `docs/architecture.md`.

- **Reactive queries.** Every screen reads through `useOwnedQuery` (`src/identity/OwnerProvider.tsx`), so an item moves from "Understanding…" to Ready, and a result appears on Home and Activity, without polling or refresh.
- **Scheduler job pipeline.** `items.create` returns at once and schedules `internal.ingest.run`; ingestion schedules `suggestForItem`; `actions.execute` schedules `internal.actions.run`; `social.drafts.generate` schedules `internal.social.composer.run`; imports schedule image attachment and ingestion (`convex/items.ts`, `convex/ingest.ts`, `convex/actions.ts`, `convex/social/drafts.ts`, `convex/imports/posts.ts`). Status lives on the documents, so the UI follows each job reactively.
- **Actions for OpenAI.** OpenAI is called only from Convex actions through a JSON-only helper (`convex/lib/llm.ts`, `convex/lib/executors/**`, `convex/social/composer.ts`, `convex/media.ts`). The key and model are deployment env vars (`OPENAI_API_KEY`, `OPENAI_MODEL`), with timeouts and one retry on 429/5xx. Actions also fetch web pages and the GitHub API and post to LinkedIn and X (`convex/lib/sources.ts`, `convex/publishing/**`).
- **File storage.** Screenshots and photos upload through `generateUploadUrl` and are served with `storage.getUrl` (`convex/items.ts`, `convex/media.ts`); vision analysis reads them in actions.
- **Search index.** Library search uses the `search_text` full-text index on `savedItems`, filtered by user and content type (`convex/schema.ts`, `items.search`).
- **HTTP routes.** `convex/http.ts` hosts the X OAuth 2.0 redirect URI for one-tap import: it finishes the PKCE token exchange in an internal action and deep-links back into the app.
- **Ownership.** No login: the app creates a device UUID, and every public function takes `ownerId` and checks it through `convex/lib/auth.ts` before reading or writing.
- **Tests.** `convex-test` and vitest cover the import pipeline, X OAuth, and the publishing adapters (`npm test`).

## Features

Shipped on `main`:

- Capture a link, text or photo; ingestion with evidence-checked facts; three contextual actions per item with real executors for scholarships, GitHub repos, design images, restaurants and documents; results with persisted checklists; Home, Library with search, Activity and Profile.
- Social Studio: drafts for five platforms from a save or a new photo, versioned edits, rewrite per platform, preview, copy, share sheet, and confirmed posting to LinkedIn and X.
- One-tap Import of X bookmarks over OAuth 2.0 PKCE, with dedupe on re-sync.

In progress (open pull requests or branches, not on `main`): GitHub stars import, YouTube liked videos import, Share to Zapy, and Instagram publishing.

## Team

Zubair Zafar and Ali Amjad, building with Capy coding agents in parallel threads.

## Run it

```bash
npm ci
npx expo start      # scan the QR code with the iPhone camera to open it in Expo Go
npm test            # vitest + convex-test
```

`.env` points the app at the dev Convex deployment. The deployment needs `OPENAI_API_KEY` and `OPENAI_MODEL`; LinkedIn and X posting and X import need their own server-side keys (see `docs/architecture.md` and `docs/limitations.md`).

## Demo

About 5 minutes on a real iPhone in Expo Go; the full script with fallbacks is `docs/demo-script.md`.

1. Save a scholarship as text, watch it turn Ready with quoted facts, run **Prepare application**, and tick checklist items that persist.
2. Save `https://github.com/expo/expo`, get different actions, and run **Extract setup guide** with commands quoted from the README.
3. Show Completed outcomes on Home and the event trail in Activity.
4. Social Studio: LinkedIn and X drafts from the repo save, Instagram and TikTok drafts from a new photo, and a live LinkedIn test post.

Revyl results for these flows are in the README under "Verified on Revyl".

## Log

### 2026-11-15 - d7e14ad
Started from a minimal Expo Router app reading a Convex items list.

### 2026-11-15 - 5df41a0
Laid down the shared contracts, a 9-table schema, ownership helpers, device identity and the items API (create, list, search, retry, upload URLs). Convex features: schema, indexes, full-text search, file storage, queries, mutations (`convex/schema.ts`, `convex/items.ts`, `convex/lib/auth.ts`).

### 2026-11-15 - cdd582d
Built ingestion: `items.create` schedules an internal action that fetches web, GitHub, image or text sources, classifies them with OpenAI in JSON mode, and keeps only facts whose evidence appears in the source. Convex features: scheduled functions, internal actions (`convex/ingest.ts`, `convex/lib/sources.ts`, `convex/lib/llm.ts`, `convex/analysis.ts`).

### 2026-11-15 - d2e3879
Added the activity feed, collections with a Moodboard, and Profile preferences and stats, and logged ingestion events (`convex/activity.ts`, `convex/collections.ts`, `convex/preferences.ts`).

### 2026-11-15 - 4a17054
Added the action catalog and executors: three actions per content type, scheduled runs, and results for scholarships, GitHub repos, design images and restaurants, with a raw-README fallback when GitHub rate-limits (`convex/actions.ts`, `convex/lib/actionCatalog.ts`, `convex/lib/executors/**`).

### 2026-11-15 - 146a12e
Shipped the app shell: tabs, Home, Capture, Library, Activity, Profile, item detail, actions and results screens on reactive queries (`src/app/**`, `src/components/**`).

### 2026-11-15 - 37cb611
Added 15 Revyl end-to-end scripts and fixtures for the Phase 1 gate (`tests/revyl/`). Wrote the README, architecture, limitations and demo script (`docs/`).

### 2026-11-15 - 0d4822a
Built Social Studio: drafts for LinkedIn, X, Instagram, TikTok and Threads from a save or a new photo, with per-platform adapters run by a scheduled composer, versioned revisions, and photo upload with vision analysis (`convex/social/**`, `convex/media.ts`, `src/app/studio/**`).

### 2026-11-15 - 9c9e922
Added publishing: a share sheet for every platform, direct posting to LinkedIn and X behind server-side keys, idempotent jobs that mark Published only with a provider post id, and a Profile test post (`convex/publishing/**`, `src/components/publishing/**`).

### 2026-11-15 - 3626f5f
Demo hardening: one-tap Save as text, first-tap Run, year-only deadline parsing, ownerId retry, timeouts and a single 429/5xx retry on OpenAI and source fetches. Renamed the app from AfterScroll to Zapy.

### 2026-11-15 - e2c38b8
Added one-tap Import of X bookmarks: OAuth 2.0 PKCE with the redirect handled by an HTTP action, paged sync, and dedupe by the post's own id; imported posts run through the same ingestion. Convex features: HTTP actions, actions, scheduled functions (`convex/http.ts`, `convex/imports/**`, `src/app/import.tsx`).

### 2026-11-15 - 37ecfcc
Restyled every screen in the Zapy light pastel design: Home, Capture, Library, item detail, Activity, results, Profile and Social Studio (`src/components/ui/**`, `src/app/**`).
