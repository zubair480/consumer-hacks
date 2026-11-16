# Zapy

**Turn what you save into what you do.**

[![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo)](https://docs.expo.dev/versions/v58.0.0/)
[![React Native 0.88](https://img.shields.io/badge/React%20Native-0.88-61DAFB?logo=react)](https://reactnative.dev)
[![TypeScript 6](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Convex](https://img.shields.io/badge/backend-Convex-EE342F)](https://convex.dev)
[![OpenAI](https://img.shields.io/badge/AI-OpenAI%20(server--side)-412991?logo=openai)](https://platform.openai.com)
[![Built with Capy](https://img.shields.io/badge/built%20with-Capy-8B5CF6)](https://capy.ai)
[![Tested on Revyl](https://img.shields.io/badge/E2E-Revyl-10B981)](tests/revyl/README.md)

Zapy is a mobile app (Expo, runs in Expo Go) for the things people save and never come back to: a GitHub repo, a scholarship or program application, an event post. It pulls those saves in, reads each source on a Convex backend with OpenAI, sorts it into a box (Code, Forms, Events, Jobs, Learn, Other) and turns it into a task with quoted facts and actions. For the three agent boxes it does the work itself after you approve it: it runs a repo in an E2B sandbox, fills a web form with Browserbase + Stagehand, or adds an event to Google Calendar through Composio.

Everything in this README was checked against `origin/main` at `71a633d` (2026-11-16). Things that are not on `main` are labelled **in progress**.

## Contents

- [TL;DR for agents](#tldr-for-agents)
- [Screenshots](#screenshots)
- [Problem, solution, who it's for](#problem-solution-who-its-for)
- [Demo walkthrough](#demo-walkthrough)
- [Features on main](#features-on-main)
- [Built with Capy, Revyl and Convex](#built-with-capy-revyl-and-convex)
- [Architecture](#architecture)
- [Repo map](#repo-map)
- [Getting started](#getting-started)
- [Testing and quality](#testing-and-quality)
- [Agent guide](#agent-guide)
- [Security and privacy](#security-and-privacy)
- [Limitations and roadmap](#limitations-and-roadmap)
- [Team and credits](#team-and-credits)

## TL;DR for agents

```yaml
name: Zapy
what: Expo Router mobile app + Convex backend. Saves (links, text, photos, X bookmarks, GitHub stars)
  are analyzed server-side with OpenAI into typed tasks with evidence-quoted facts and 3 contextual
  actions; GitHub / form / event saves get an approval-gated agent action (E2B, Browserbase, Composio).
stack:
  app: Expo SDK 58 (~58.0.25), React Native 0.88.1, React 19.3, Expo Router, TypeScript ~6.0, Expo Go only
  backend: Convex ^1.50 (schema, queries, mutations, actions, scheduler, file storage, search index, HTTP routes)
  ai: OpenAI from Convex actions only (convex/lib/llm.ts), model from OPENAI_MODEL, JSON output
  agents: e2b (Run it for me), @browserbasehq/stagehand (Fill it for me), Composio REST (Add to my calendar)
entry_points:
  app: src/app/_layout.tsx (providers), src/app/(tabs)/index.tsx (Home / Your tasks), src/app/welcome.tsx (start flow)
  backend: convex/schema.ts, convex/http.ts, convex/items.ts, convex/ingest.ts, convex/actions.ts, convex/demo.ts
  contracts: src/shared/contracts.ts, src/shared/socialContracts.ts (additive changes only)
commands:
  install: npm ci
  run: npx expo start            # scan the QR code with Expo Go
  run_android_usb: npx expo start --localhost --port 8082   # then: adb reverse tcp:8082 tcp:8082
  test: npm test                 # vitest + convex-test, 21 files / 185 tests
  typecheck: npx tsc --noEmit
  lint: npx expo lint
  e2e: tests/revyl/*.yaml on a Revyl cloud iPhone 16 (see tests/revyl/README.md)
convex:
  deployment: pleasant-lark-678 (shared dev)
  client_url: https://pleasant-lark-678.convex.cloud   # committed in .env as EXPO_PUBLIC_CONVEX_URL
  http_actions: https://pleasant-lark-678.convex.site
  deploy_rule: only from a clean checkout of origin/main; "npx convex dev --once" replaces ALL functions
env:
  client: [EXPO_PUBLIC_CONVEX_URL]
  server_required: [OPENAI_API_KEY]
  server_optional: [OPENAI_MODEL, GITHUB_TOKEN, E2B_API_KEY, BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID,
    COMPOSIO_API_KEY, COMPOSIO_GCAL_AUTH_CONFIG_ID, X_CLIENT_ID, X_CLIENT_SECRET, GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET, LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN, X_API_KEY, X_API_SECRET,
    X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, CONVEX_SITE_URL]
identity_rule: >
  No login. The app makes a device UUID (ownerId, src/identity/OwnerProvider.tsx). Every public Convex
  function takes ownerId and checks it with requireUser / requireOwnedItem / requireOwned
  (convex/lib/auth.ts). Client code calls useOwnedQuery / useOwnedMutation, which inject ownerId.
docs: [README.md, llms.txt, AGENTS.md, docs/architecture.md, docs/limitations.md, docs/demo-script.md,
  docs/design-system.md, docs/ios-shortcut.md, docs/android-share.md, docs/youtube-import-setup.md, tests/revyl/README.md]
```

## Screenshots

Captured from `main` builds on 2026-11-15/16: Revyl cloud iPhone 16 renders, plus two shots from a phone running Expo Go (marked).

| Start flow | Pull everything | Your tasks |
| --- | --- | --- |
| <img src="docs/screenshots/start-questionnaire.png" width="230" alt="One-screen About you questionnaire"> | <img src="docs/screenshots/pull-everything.png" width="230" alt="Pulling it all in, saves sorted into six boxes"> | <img src="docs/screenshots/home-your-tasks.png" width="230" alt="Your tasks queue with To review, All and Done tabs and the Home / You dock"> |
| One-screen questionnaire: name, school, field of study, city. | Pull everything seeds the demo saves (and syncs X when connected) and sorts them into boxes. | The task queue: To review / All / Done, search, and the two-tab Home \| You dock. |
| **Run it for me** (Expo Go) | **Run result** | **Fill it for me** |
| <img src="docs/screenshots/task-run-it-for-me.png" width="230" alt="GitHub task with the Run it for me button and three more actions"> | <img src="docs/screenshots/run-result-hello-world.png" width="230" alt="E2B run result: clone, install, npm start printed Hello World"> | <img src="docs/screenshots/fill-it-for-me-details.png" width="230" alt="Zapy will use these: name, email, phone, studying"> |
| A GitHub save: the big agent action plus three contextual actions. | E2B cloned `zubair480/zapy-hello-world`, installed it and `npm start` printed Hello World. | The details sheet before Browserbase fills the form. |
| **Added to Google Calendar** (Expo Go, Android) | | |
| <img src="docs/screenshots/event-added-to-calendar.png" width="230" alt="Event save showing Added to Google Calendar"> | | |
| An event save after the approved Composio calendar write. | | |

## Problem, solution, who it's for

**Problem.** People save hundreds of posts, links and screenshots (repos to try, scholarships to apply to, events to attend) and act on almost none of them, because each one still needs reading, deciding and a chore.

**Solution.** Zapy pulls the saves in, works out what each one is, keeps only facts it can quote from the source, and turns the save into a task. Each task has three contextual actions that produce saved results (checklists, guides, briefs), and the Code, Forms and Events boxes get one agent action that does the chore after you approve it.

**Who it's for.** Students and early-career builders who bookmark opportunities and tools on X, GitHub and the web: the demo profile is a computer-science undergraduate with a GitHub repo to try, a camp and a scholarship to apply to, and a summit to attend.

## Demo walkthrough

This is the live flow on `main` (the full script with fallbacks is [docs/demo-script.md](docs/demo-script.md); the steps below are the current code paths).

> **Use synthetic details.** The flow below asks for an email and phone and submits them to the hosted demo form; `GET /demo/submissions` is public and lists every submission.

1. **Intro.** The ZapMark intro plays on launch (`src/components/brand/ZapIntro.tsx`, skip with `zap-intro-skip`).
2. **Start.** On first launch Home sends a new device to `/welcome` (`src/app/welcome.tsx`). Tap **Start** (`onboarding-start`).
3. **One-screen questionnaire.** Name, where you are in school (chips), what you study, which city; **Continue** saves them with `preferences.upsert`.
4. **Complete your account.** Email and phone (used later by Fill it for me) and an optional **Connect X** (`account-connect-x`, X OAuth 2.0 PKCE).
5. **Connect your calendar.** Composio Google Calendar connect (`CalendarConnectRow`), or **Not now** (`calendar-skip`).
6. **Pull everything** (`src/app/pull.tsx`). `demo.pullEverything` seeds four demo saves (the `zapy-hello-world` repo, a camp application, a scholarship, a nurses summit post; `convex/lib/demo.ts`), schedules ingestion for each, and schedules X / GitHub syncs if connected. The six boxes count up live from `demo.pullStatus`. Tap **See my tasks** (`pull-see-tasks`).
7. **Your tasks** (`src/app/(tabs)/index.tsx`). Cards are colored by box (`src/lib/boxes.ts`), with **To review / All / Done** tabs, search once there are 3+ saves, pull-to-refresh (runs `imports.sync.syncAll`), and a **Connect X** pill while X is not connected. The dock has two tabs: **Home** and **You**.
8. **Run it for me** (GitHub save). Open the repo task and tap the big button (`task-primary-action`). `agentRuns.startRunRepo` creates a `run_repo` execution and schedules `agentMode.runRepo`, which clones the repo in an E2B sandbox, installs it and runs its start/test script. The result screen shows the terminal transcript (verified live: `npm start` printed **Hello World** on `zubair480/zapy-hello-world`). Needs `E2B_API_KEY`; without it the button is hidden (`agentRuns.runRepoAvailable`).
9. **Fill it for me** (camp / scholarship save). Tap the button, check the **Zapy will use these** sheet (name, email, phone, studying; **Remember these** saves them to your profile), tap **Fill the form**. `formFill.start` schedules `formFillAgent.run`: Browserbase opens the form and Stagehand fills it but never submits (`convex/lib/formGuard.ts` refuses submit-like and login instructions). The run stops at **needs_approval** ("Ready for your OK") with the filled fields and screenshots (`src/app/fill/[runId].tsx`), held for up to 8 minutes. **Approve and open the form** (`fill-approve`) marks the run approved and opens the Browserbase live view. On the hosted demo form `/demo/apply` the agent then clicks Submit itself (status **submitted**); on any other site it never submits, and you review and submit in the live view. **Cancel** closes the session. Verified live: a run reached needs_approval and submitted on `/demo/apply`; submissions are listed at `/demo/submissions`.
10. **Add to my calendar** (event save). `agents/calendar.prepare` drafts a proposal (title, time, timezone, duration, location) from the source and stops at **needs_approval**; you can edit it. **Approve** runs `GOOGLECALENDAR_CREATE_EVENT` through Composio; the item shows **Added to Google Calendar ✓**. A source with no date leaves the date empty and blocks approval until you fill it in.
11. **Social Studio drafts.** On any item, **Create post** (`create-post`) opens `/studio/platforms` → per-platform editor → preview. Drafts are generated server-side for LinkedIn, X, Instagram, TikTok and Threads.

**Fallbacks.** Pull everything is idempotent per device: tap it again and it re-queues any demo save stuck in Needs info or Failed. A save that can't be read shows **Add screenshot / Paste text**; a failed one shows **Retry analysis**. **You → Replay welcome** reruns the start flow. If Browserbase can't start on the demo form, `formFillAgent.run` drafts the values from your profile without a browser, still stops at needs_approval, and on approval POSTs them to `/demo/apply`; on other sites a failure shows the error with **Try again**.

## Features on main

### Capture and import

| Source | How | Code |
| --- | --- | --- |
| Link, text, photo | Capture modal (Link / Text / Photo). Photos are resized to 1600 px JPEG and uploaded to Convex file storage. Invalid links offer **Save as text instead**. Capture has no button in the current UI; it is reachable from Import (**paste fallback**) and the deep link `zapy:///capture?mode=url`. | `src/app/capture.tsx`, `convex/items.ts` |
| Demo saves | **Pull everything** seeds four saves (idempotent per owner via `demoKey`). | `convex/demo.ts`, `convex/lib/demo.ts` |
| X bookmarks | OAuth 2.0 PKCE (`imports.connections.startXConnect` → `/oauth/x/callback`), paged sync, dedupe by post id. Auto-sync: Home schedules `imports.sync.syncAll` on focus/foreground (at most once a minute) and on pull-to-refresh. | `convex/imports/connections.ts`, `convex/imports/xClient.ts`, `convex/imports/sync.ts` |
| GitHub stars | By username, no token needed; starred repos become `github_repository` saves; auto-syncs with X. | `convex/imports/github.ts`, `src/components/GitHubStarsRow.tsx` |
| Share to Zapy | `POST /save` with a bearer share token, 30 requests/min per user; iOS Shortcut and Android HTTP Shortcuts guides. The backend is on main, but the in-app token card (`ShareToZapyCard`) is not mounted on any screen right now. | `convex/share.ts`, [docs/ios-shortcut.md](docs/ios-shortcut.md), [docs/android-share.md](docs/android-share.md) |
| YouTube liked videos | Google OAuth backend and `/oauth/google/callback` are on main; not listed on the Import screen. | `convex/imports/youtube.ts`, [docs/youtube-import-setup.md](docs/youtube-import-setup.md) |

### Understanding

- `ingest.run` (internal action) fetches the source (web page, GitHub REST + raw README, image via vision, or the text) and asks OpenAI to classify it into one or more of **14 content types**: restaurant, github_repository, code_snippet, scholarship, job, application, graphic, recipe, event, travel, product, research, tutorial, general_content (`CONTENT_TYPES` in `src/shared/contracts.ts`).
- **Evidence-quoted facts.** Every extracted fact carries an evidence quote. For text sources a fact is kept only if the first 120 normalized characters of its quote appear in the fetched text (`verifiedFacts` in `convex/analysis.ts`); facts from an image rely on the model's visual evidence and can't be checked textually. Neither check proves the model read the quote correctly. Key facts (deadline, location, price, organization) are copied onto the save only when a checked fact backs them.
- **Missing info.** Facts the source doesn't state are listed as missing, never guessed. If the source can't be read, the status is **Needs info** with Add screenshot / Paste text.
- **Statuses** (`EXTRACTION_STATUSES`): pending → extracting → analyzing → ready | needs_input | failed.

### The task queue

Home is the task queue: each save is a card in its box color, in one of three states (running, to review, done once an action result exists). Tabs: To review, All, Done, with counts. The item screen shows the type chips, summary, the big agent action (for Code / Forms / Events), **More actions** (the three contextual actions), facts (tap to see the quote), results and source.

### Agent actions with approval gates

| Box | Action | Service | Gate | Code |
| --- | --- | --- | --- | --- |
| Code (`github_repository`) | Run it for me | E2B sandbox (5 min timeout) | Runs only on your tap; read-only clone of a public repo | `convex/agentRuns.ts`, `convex/agentMode.ts`, `convex/lib/runRepo.ts` |
| Forms (`application`, `scholarship`) | Fill it for me | Browserbase + Stagehand (model `openai/<OPENAI_MODEL>`) | Fills only; stops at needs_approval (8 min). After **Approve**, submits only the hosted demo form; elsewhere you submit in the live view | `convex/formFill.ts`, `convex/formFillAgent.ts`, `convex/lib/formGuard.ts` |
| Events (`event`) | Add to my calendar | Composio Google Calendar | Proposal → **Approve**; blocked without a date | `convex/agents/calendar.ts`, `convex/agents/composio.ts` |

The box → action mapping is `primaryAgentAction` in `convex/lib/demo.ts` (mirrored for display in `src/lib/boxes.ts`).

### Contextual actions

Every content type gets three ranked actions (`CATALOG_ROUTING` in `convex/lib/actionCatalog.ts`, built on `ACTION_ROUTING` / `FALLBACK_ACTIONS` in `src/shared/contracts.ts`). Labels come from `ACTION_LABELS`. Actions marked † ask for confirmation (`requiresApproval`).

| Content type | Action 1 | Action 2 | Action 3 |
| --- | --- | --- | --- |
| restaurant | Plan a visit | Find location | Prepare invitation † |
| github_repository | Understand project | Extract setup guide | Prepare integration plan |
| code_snippet | Explain | Suggest test cases | Prepare reusable example |
| scholarship | Check eligibility | Prepare application | Track verified deadline |
| application | Check eligibility | Prepare application | Track verified deadline |
| job | Check eligibility | Prepare application | Track verified deadline |
| graphic | Extract style | Create design brief | Add to moodboard |
| recipe | Create shopping list | Show cooking steps | Plan meal |
| event | Find location | Prepare invitation † | Track verified deadline |
| travel | Find location | Extract key points | Add to collection |
| product | Extract key points | Summarize | Add to collection |
| research | Summarize | Extract key points | Add to collection |
| tutorial | Summarize | Extract key points | Add to collection |
| general_content | Summarize | Extract key points | Add to collection |

`run_repo` (Run it for me) is an agent action outside this routing (`AGENT_ACTIONS`), started by its own mutation.

### Results

`actions.execute` schedules `actions.run`, which calls the executor for the action type (`convex/lib/executors/`: scholarship, github, graphic, restaurant, and generic for everything else). Executors check each cited quote against the fetched source and drop what doesn't match, with a warning. A result (`ActionResultDocument`) has sections of kind text, checklist, steps, key_value, list, links, code or palette, plus warnings and sources; checklist ticks persist (`items.setChecklistItem`). Execution status: queued → running → succeeded | failed (also awaiting_approval, cancelled).

### Social Studio and publishing

- **Drafts** for LinkedIn, X, Instagram, TikTok and Threads from a save or a new photo (`convex/social/drafts.ts`, composer `convex/social/composer.ts`, adapters `convex/social/adapters/`). Facts are kept separate from creative text, every edit is a new revision, and rewriting one platform leaves the others alone. Drafts are stripped of emoji (`convex/social/sanitize.ts`).
- **Publishing** (`convex/publishing/`): LinkedIn and X post directly only when their server keys are set; everything else uses the share sheet. A draft becomes **Published** only when the provider returns a post id; "I posted it" is recorded as user-reported.
- **Reachability on main:** Studio opens from **Create post** on an item; the editor's **Share** opens the publish sheet, which posts directly when that platform's server keys are set. The Create tab is hidden from the dock, and the Connected accounts / Send test post card was removed from the You tab (#107).
- **In progress:** Instagram API publishing ([#28](https://github.com/zubair480/consumer-hacks/pull/28), frozen, not merged); similar saves via vector search ([#70](https://github.com/zubair480/consumer-hacks/pull/70), open).

### Hidden but present

Library (`src/app/(tabs)/library.tsx`), Activity (`activity.tsx`) and Create (`create.tsx`) are registered with `href: null` in `src/app/(tabs)/_layout.tsx`, so their routes and backend still exist but the dock doesn't show them.

## Built with Capy, Revyl and Convex

### Capy

The app was built in one day by Capy coding agents running in parallel threads, directed by Captain threads: **CONS-2** (Zubair's Captain, "AfterScroll Lead") and **CONS-18** (Ali's Captain). The Captain wrote the shared contracts first (`src/shared/contracts.ts`), then gave each crew thread an exclusive slice of files, one PR per slice, and merged after `tsc`, a Convex deploy and Revyl evidence. The ownership comments are still in the code (`// OWNER: ...`).

| Owner (thread) | Files |
| --- | --- |
| Lead | `src/shared/contracts.ts`, `convex/schema.ts`, `convex/lib/auth.ts`, `convex/items.ts`, `src/identity/` |
| B+C (ingestion) | `convex/ingest.ts`, `convex/analysis.ts`, `convex/lib/sources.ts`, `convex/lib/llm.ts` |
| D+E (actions) | `convex/actions.ts`, `convex/lib/actionCatalog.ts`, `convex/lib/executors/` |
| F (activity) | `convex/activity.ts`, `convex/collections.ts`, `convex/preferences.ts` |
| A (UI) | `src/app/`, `src/components/`, `src/theme/` |
| H+I (Social Studio) | `convex/social/`, `convex/media.ts`, `src/shared/socialContracts.ts`, `src/app/studio/` |
| J (publishing) | `convex/publishing/`, `src/components/publishing/` |
| CONS-19 (import) | `convex/imports/`, `src/app/import.tsx` |
| CONS-22 (share) | `convex/share.ts`, `convex/shareSchema.ts` |
| Agent mode (ZUB-36 etc.) | `convex/agentRuns.ts`, `convex/agentMode.ts`, `convex/formFill*.ts`, `convex/agents/` |

**Numbers from git and GitHub** (computed on `origin/main` at `71a633d`):

- **106 merged pull requests** (#1–#108; #70 is open and #28 is frozen).
- **145 commits** on main: 70 by zubair480, 22 by ali-amjad52114, 53 by capy-ai[bot] (the bot's are PR merge commits). Excluding merges: 67 zubair480, 12 ali-amjad52114, 1 capy-ai[bot].
- First commit 2026-11-15 21:54 UTC, latest 2026-11-16 02:15 UTC.

Representative PRs: [#2 contracts, schema, ownership](https://github.com/zubair480/consumer-hacks/pull/2), [#6 ingestion with evidence-checked analysis](https://github.com/zubair480/consumer-hacks/pull/6), [#9 action routing and executors](https://github.com/zubair480/consumer-hacks/pull/9), [#43 X bookmarks via OAuth 2.0 PKCE](https://github.com/zubair480/consumer-hacks/pull/43), [#83 E2B Run it for me](https://github.com/zubair480/consumer-hacks/pull/83), [#86 demo flow backend with approve-then-submit](https://github.com/zubair480/consumer-hacks/pull/86).

Recompute:

```bash
git log origin/main --format='%an' | sort | uniq -c
git log origin/main --no-merges --format='%an' | sort | uniq -c
gh pr list --state merged --limit 300 --json number --jq length
```

### Revyl

Fifteen end-to-end scripts in [tests/revyl/](tests/revyl/README.md) run on a Revyl cloud iPhone 16 against a Release simulator build pointed at the dev deployment (fixtures in `tests/revyl/fixtures/fixtures.json`):

| Script | Checks |
| --- | --- |
| `01-app-launches` | Fresh install launches and walks the first-launch flow |
| `02-home-works` | Home renders |
| `03-url-saved` | Saving a GitHub URL through Capture |
| `04-text-saved` | Saving scholarship text |
| `05-screenshot-saved` | Saving a screenshot |
| `06-library-persists` | Saves persist after relaunch (Home All tab) |
| `07-ai-classifies-github` | The repo is classified as a GitHub repo |
| `08-github-actions-appear` | The three GitHub actions appear |
| `09-repo-explanation-executes` | Understand project runs and renders a result |
| `10-scholarship-actions-appear` | The scholarship actions appear |
| `11-application-checklist-executes` | Prepare application produces a checklist |
| `12-design-image-analyzed` | A design image is analyzed |
| `13-outcomes-persist` | Results persist after relaunch |
| `14-invalid-url-recovery` | Invalid URL → Save as text recovery |
| `15-navigation-no-crash` | Every tab and screen opens and closes without a crash |

**Results we have** (all 2026-11-15, Revyl iPhone 16):

| Run | Build | Result |
| --- | --- | --- |
| Phase 1 gate, scripts 01–15 | `f9f1db1` (tag `phase-1`) | 15/15 pass ([#27](https://github.com/zubair480/consumer-hacks/pull/27)) |
| Core regression: GitHub save → Ready → Understand project → reopen; persistence across relaunch | `6d80bec` | pass |
| Save as text for an invalid link; Prepare application on first tap | `7f327f9` | pass |
| Social Studio without publishing: LinkedIn + X drafts, edit/rewrite isolation, preview, persistence, copy, photo drafts | `ad2202d` | 6/6 pass |
| Start flow and demo flow renders (screenshots above) | latest main UI | captured, not a scripted pass/fail run |

**Not covered:** there has been **no full regression run of 01–15 after the latest UI changes** (start flow, two-tab dock, Accounts card). The scripts were updated for the new UI (deep link into Capture, Home \| You dock) but not re-run end to end. The agent actions were verified live by hand, not by Revyl scripts.

**Rerun** (unverified outline, macOS with Xcode and CocoaPods): `npm ci && npx expo prebuild --platform ios`, then `(cd ios && pod install)`, then from the repo root `xcodebuild -workspace ios/<Workspace>.xcworkspace -scheme <Scheme> -configuration Release -sdk iphonesimulator -derivedDataPath build/ios CODE_SIGNING_ALLOWED=NO`, using the workspace and scheme names prebuild generates; the app lands in `build/ios/Build/Products/Release-iphonesimulator/`. Install it on one Revyl iPhone 16, run 01→15 in order (06 and 13 depend on earlier tests), one screenshot per step. Details: [tests/revyl/README.md](tests/revyl/README.md).

### Convex

| Feature | Where |
| --- | --- |
| Schema, 23 tables | `convex/schema.ts` plus spreads from `convex/imports/schema.ts`, `convex/social/schema.ts`, `convex/shareSchema.ts`, `convex/formFillSchema.ts`, `convex/agents/schema.ts` |
| Indexes | every table is read through `withIndex`, e.g. `savedItems.by_userId_and_createdAt`, `by_userId_and_sourceUrl` (dedupe), `importedPosts.by_userId_and_platform_and_externalId` |
| Full-text search index | `savedItems.search_text` on `searchText`, filter fields `userId`, `primaryType` (`items.search`) |
| Queries and mutations | all public ones take `ownerId` (see the [API map](#convex-api-map)) |
| Scheduled functions | `ctx.scheduler.runAfter(0, ...)` chains: `items.create` → `ingest.run` → `actions.suggestForItem`; `actions.execute` → `actions.run`; `agentRuns.startRunRepo` → `agentMode.runRepo`; `formFill.start` → `formFillAgent.run`; `calendar.approve` → `calendar.execute`; `social.drafts.generate` → `social.composer.run`; `imports.sync.syncAll` → `syncX` / `github.sync`. No crons (#68 added them, #74 reverted). |
| Actions / internal actions | OpenAI, web and GitHub fetches, E2B, Browserbase, Composio, X/LinkedIn APIs (`"use node"` where the SDK needs Node) |
| File storage | photos and screenshots (`items.generateUploadUrl`, `media.generateUploadUrl`), form-fill screenshots (`formFillRuns.screenshotIds`) |
| HTTP routes | `convex/http.ts`, listed below |
| Env vars | see [Environment variables](#environment-variables) |
| Tests | 19 `convex-test` / vitest suites under `convex/`, 2 under `tests/` |

HTTP routes on `https://pleasant-lark-678.convex.site` (`convex/http.ts`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/oauth/x/callback` | X OAuth 2.0 PKCE redirect; finishes the token exchange and returns to the app |
| GET | `/oauth/google/callback` | Google OAuth redirect for YouTube import |
| GET | `/composio/callback` | Composio Google Calendar connect return; 302 to an allow-listed app deep link |
| POST | `/save` | Share to Zapy (bearer share token, 30/min) |
| GET | `/demo/apply` | Hosted demo application form (`?program=` variants) that Fill it for me fills |
| POST | `/demo/apply` | Records a demo form submission |
| GET | `/demo/post/nurses-summit` | The demo event post behind the summit save |
| GET | `/demo/submissions` | Recent demo form submissions (proof the agent submitted) |

## Architecture

More depth: [docs/architecture.md](docs/architecture.md).

### System overview

```mermaid
flowchart LR
  subgraph Phone["Phone: Expo Go"]
    UI["Expo Router screens<br/>welcome, pull, Home, You, item, result, fill, studio"]
    Owner["OwnerProvider<br/>device ownerId"]
  end
  subgraph Convex["Convex: pleasant-lark-678"]
    API["Public queries and mutations<br/>(ownerId checked)"]
    Jobs["Scheduled internal actions<br/>ingest, executors, agents, composer, imports"]
    DB[("23 tables + file storage<br/>+ search index")]
    HTTP["HTTP routes<br/>OAuth callbacks, /save, /demo"]
  end
  OpenAI["OpenAI"]
  E2B["E2B sandbox"]
  BB["Browserbase + Stagehand"]
  Composio["Composio<br/>Google Calendar"]
  Ext["X, GitHub, LinkedIn,<br/>web pages"]
  UI --> Owner --> API
  API --> DB
  API -- "scheduler" --> Jobs
  Jobs --> DB
  Jobs --> OpenAI
  Jobs --> E2B
  Jobs --> BB
  Jobs --> Composio
  Jobs --> Ext
  HTTP --> Jobs
  DB -. "reactive queries" .-> UI
```

### Save → ingest → analyze → suggest

```mermaid
sequenceDiagram
  participant App
  participant Items as items.create / demo.pullEverything
  participant Ingest as ingest.run (internal action)
  participant OpenAI
  participant Actions as actions.suggestForItem
  App->>Items: create({ ownerId, url | text | imageStorageId })
  Items-->>App: itemId (extractionStatus: pending)
  Items->>Ingest: scheduler.runAfter(0)
  Ingest->>Ingest: fetch source (web, GitHub, image, text)
  Ingest->>OpenAI: classify + extract facts with evidence (JSON)
  OpenAI-->>Ingest: types, facts, missing info
  Ingest->>Ingest: drop text facts whose quote is not in the source
  Ingest->>Items: setExtraction (ready | needs_input | failed), save contentAnalysis
  Ingest->>Actions: scheduler.runAfter(0)
  Actions->>Actions: 3 ranked suggestions from CATALOG_ROUTING
  Items-->>App: reactive update: card moves to To review
```

### Agent action with an approval gate (Fill it for me)

```mermaid
sequenceDiagram
  participant User
  participant App
  participant FF as formFill (mutations)
  participant Agent as formFillAgent.run
  participant BB as Browserbase + Stagehand
  User->>App: Fill it for me, confirm details
  App->>FF: start({ ownerId, itemId })
  FF->>Agent: scheduler.runAfter(0)
  Agent->>BB: open form, fill fields (formGuard blocks submit/login)
  BB-->>Agent: filled fields + screenshots
  Agent->>FF: setState(needs_approval, expiresAt)
  FF-->>App: fill/[runId] shows fields and screenshots
  alt Approve and open the form
    User->>App: Approve
    App->>FF: approve({ ownerId, runId }) sets status approved
    Agent->>FF: polls getStatus every 3 s, sees approved
    Agent->>BB: click Submit (hosted /demo/apply only)
    Agent->>FF: setState(submitted)
    App->>BB: open live view (other sites: user submits)
  else Cancel or 8 min expiry
    App->>FF: cancel()
    FF->>FF: cancelled / expired, nothing submitted
  end
```

Add to my calendar follows the same shape: `calendar.prepare` writes a proposal with status `needs_approval`, and only `calendar.approve` schedules `calendar.execute`, the one function that calls Composio.

### Data model

| Table | Purpose | Key fields | Indexes |
| --- | --- | --- | --- |
| `users` | One row per device | ownerId, displayName, shareToken | by_ownerId, by_shareToken |
| `savedItems` | A save | sourceKind, sourceUrl, rawText, imageStorageId, contentTypes, primaryType, key facts, extractionStatus, searchText, demoKey | by_userId_and_createdAt, by_userId_and_primaryType_and_createdAt, by_userId_and_extractionStatus, by_userId_and_sourceUrl, search index search_text |
| `contentAnalysis` | Full analysis | facts (with evidence), title, summary, model | by_itemId, by_userId |
| `actionSuggestions` | 3 ranked actions per item | actionType, requiredInputs, requiresApproval, rank | by_itemId_and_rank, by_userId |
| `actionExecutions` | Each action run | actionType, status, inputs, error | by_itemId_and_createdAt, by_userId_and_createdAt, by_userId_and_status |
| `actionResults` | Result document | result (sections, warnings, sources) | by_executionId, by_itemId, by_userId_and_createdAt |
| `collections` | Collections incl. Moodboard | name, kind | by_userId_and_createdAt |
| `activityEvents` | Activity feed | type, title, itemId, executionId | by_userId_and_createdAt, by_itemId |
| `userPreferences` | Profile used by actions and form fill | name, educationLevel, fieldOfStudy, country, citizenship, gpa, city, interests, email, phone, homeCity, profileFacts | by_userId |
| `importConnections` | OAuth tokens per platform (server-only) | platform, accessToken, refreshToken, expiresAt, lastSync* | by_userId_and_platform |
| `importOAuthStates` | Pending PKCE handshakes | state, codeVerifier, returnUrl | by_state |
| `importedPosts` | Import dedupe | platform, externalId, itemId | by_userId_and_platform_and_externalId |
| `githubImportAccounts` | GitHub stars username | username, lastSync* | by_userId |
| `mediaAssets` | Studio photos | storageId, kind, analysis | by_userId_and_createdAt |
| `socialDrafts` | Latest draft per platform per source | platform, draftText, output, provenance, status, generationStatus, revision | by_userId_and_sourceSavedItemId, by_userId_and_sourceMediaId, by_userId_and_updatedAt |
| `socialDraftRevisions` | Every draft revision | draftId, revision, source | by_draftId_and_revision |
| `platformConnections` | Per-platform connection state (in schema, not written yet) | platform, connectionStatus | by_userId_and_platform |
| `publishingJobs` | Publish/share attempts | draftId, status, idempotencyKey, externalPostId | by_draftId, by_userId_and_createdAt |
| `publishingResults` | Outcome per job | outcome, externalPostId, externalUrl | by_jobId, by_draftId |
| `shareRateLimits` | /save rate window | windowStart, count | by_userId |
| `formFillRuns` | Fill it for me runs | url, status, fields, screenshotIds, liveViewUrl, expiresAt | by_userId_and_itemId, by_userId_and_createdAt |
| `agentJobs` | Calendar agent jobs | kind, status, proposal, resultUrl | by_userId_and_itemId, by_userId |
| `demoFormSubmissions` | Submissions to /demo/apply | name, email, phone, studying, program | by_createdAt |

23 application tables in total, plus Convex's system tables (`_storage`, `_scheduled_functions`).

### Convex API map

Public functions by module (`q` query, `m` mutation, `a` action). All take `ownerId`.

| Module | Public functions |
| --- | --- |
| `items` | q: list, listPage, search, get · m: generateUploadUrl, create, update, retry, remove, setChecklistItem |
| `actions` | q: listSuggestions, getExecution, getResult, listResultsForItem, recentOutcomes, recentOutcomesPage · m: execute |
| `analysis` | q: getForItem |
| `demo` | q: pullStatus, primaryAction · m: pullEverything |
| `agentRuns` | q: runRepoAvailable, latestRunRepo · m: startRunRepo |
| `formFill` | q: available, get, latestForItem · m: start, approve, cancel |
| `agents/calendar` | q: configured, latestForItem · m: prepare, updateProposal, approve, cancel, retry · a: startConnect, connectionStatus |
| `imports/connections` | q: sources · m: disconnect · a: startXConnect, syncX |
| `imports/github` | q: status · a: sync |
| `imports/youtube` | q: status · a: startConnect, sync |
| `imports/posts` | m: importBatch |
| `imports/sync` | m: syncAll |
| `users` | q: me · m: ensure, setDisplayName |
| `preferences` | q: get, stats · m: upsert |
| `activity` | q: list, listPage, listForItem |
| `collections` | q: list, get · m: create, rename, remove, addItem, removeItem |
| `share` | m: getOrCreateShareToken, rotateShareToken |
| `media` | q: get, list · m: generateUploadUrl, createMediaAsset, setContext · a: analyzeMedia |
| `social/drafts` | q: listForSource, listRecent, get, recommendPlatforms · m: generate, update, regenerate, restoreRevision |
| `publishing/jobs` | q: statusForDraft, listForSource, connectedAccounts · m: markReadyToShare, startShare, confirmUserPosted, markFailed · a: publish |
| `publishing/testPost` | a: sendTestPost |

### External services

| Service | What it does | Called from | Env |
| --- | --- | --- | --- |
| OpenAI | Classification, fact extraction, executors, social drafts, photo analysis, Stagehand's model | `convex/lib/llm.ts`, `convex/lib/executors/openai.ts`, `convex/social/composer.ts`, `convex/media.ts`, `convex/formFillAgent.ts` | `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-4.1-mini`; dev uses `gpt-5.4-mini`) |
| E2B | Sandbox that clones, installs and runs a GitHub repo | `convex/agentMode.ts` | `E2B_API_KEY` |
| Browserbase + Stagehand | Cloud browser that fills a form and waits for approval | `convex/formFillAgent.ts` | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` |
| Composio | Google Calendar connect and `GOOGLECALENDAR_CREATE_EVENT` | `convex/agents/composio.ts` | `COMPOSIO_API_KEY`, `COMPOSIO_GCAL_AUTH_CONFIG_ID` |
| X | Bookmarks import (OAuth 2.0 PKCE); optional posting (OAuth 1.0a) | `convex/imports/xClient.ts`, `convex/publishing/x.ts` | `X_CLIENT_ID`, `X_CLIENT_SECRET`; `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` |
| LinkedIn | Optional direct posting | `convex/publishing/linkedin.ts` | `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_PERSON_URN` |
| GitHub | Repo metadata + README for analysis; stars import | `convex/lib/sources.ts`, `convex/imports/githubClient.ts` | `GITHUB_TOKEN` (optional, avoids rate limits) |
| Google (YouTube) | Liked videos import backend | `convex/imports/youtubeClient.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |

## Repo map

```text
.
├── AGENTS.md / CLAUDE.md        # project rules for coding agents (Expo Go only, Convex deploy rule, ownerId)
├── llms.txt                     # LLM index of this repo
├── app.json                     # Expo config (name Zapy, scheme zapy)
├── .env                         # EXPO_PUBLIC_CONVEX_URL only (public)
├── src/
│   ├── app/                     # Expo Router routes (every file is a screen)
│   │   ├── _layout.tsx          # ConvexProvider, OwnerProvider, fonts, intro, toasts
│   │   ├── (tabs)/              # dock: index (Home / Your tasks), profile (You); library, activity, create hidden
│   │   ├── welcome.tsx          # start flow: Start → About you → account → calendar
│   │   ├── pull.tsx             # Pull everything + six boxes
│   │   ├── item/[id]/           # task detail (index) and contextual actions (actions)
│   │   ├── result/[id].tsx      # action / Run it for me result
│   │   ├── fill/[runId].tsx     # Fill it for me run + approval
│   │   ├── capture.tsx          # Link / Text / Photo capture modal
│   │   ├── import.tsx           # X bookmarks + GitHub stars