# AfterScroll

Turn what you save into what you do. Expo SDK 58 + Expo Router + Convex, iOS-first, runs in Expo Go.

## Run

```bash
npm install
npx expo start          # .env points the app at the dev Convex deployment
npx convex dev --once   # push backend changes (needs CONVEX_DEPLOY_KEY)
```

Server-side env on the Convex deployment: `OPENAI_API_KEY`, `OPENAI_MODEL` (gpt-5.4-mini). The app never calls OpenAI directly.

## Identity

No login. `src/identity/OwnerProvider.tsx` creates a UUID once (expo-crypto) and keeps it in expo-secure-store. Every public Convex function takes `ownerId`; use `useOwnedQuery(api.x.y, args)` and `useOwnedMutation(api.x.y)`, which inject it. On the server, resolve it with `convex/lib/auth.ts` (`requireUser`, `requireOwnedItem`, `requireOwned`) before touching data.

## File ownership (Phase 1 parallel threads)

Edit only the files your thread owns. Shared types change only through `src/shared/contracts.ts`, via the Captain, and only additively.

| Owner | Files |
| --- | --- |
| Lead | `src/shared/contracts.ts`, `convex/schema.ts`, `convex/lib/validators.ts`, `convex/lib/auth.ts`, `convex/items.ts`, `convex/users.ts`, `src/identity/**`, `src/theme/**`, `src/components/ui/**`, `app.json`, `package.json` |
| A — UI/UX | `src/app/**`, `src/components/**` except `src/components/ui` |
| B+C — ingestion + understanding | `convex/ingest.ts` (replace the stub, keep `run({ itemId })`), `convex/analysis.ts`, `convex/lib/llm.ts`, `convex/lib/sources.ts` |
| D+E — routing + executors | `convex/lib/actionCatalog.ts`, `convex/actions.ts`, `convex/lib/executors/**` |
| F — backend | `convex/activity.ts`, `convex/collections.ts`, `convex/preferences.ts` |

Schema changes by other threads: new optional fields or new indexes only, coordinated through the Captain. New dependencies: `npx expo install`, Expo Go-compatible only, and tell the Captain since `package.json` is shared.

## Integration points

- **Ingestion (B+C):** `items.create` and `items.retry` schedule `internal.ingest.run({ itemId })`. Read with `internal.items.getForProcessing`, write status and understood fields with `internal.items.setExtraction` (keeps Library search text in sync), store the `ContentAnalysis` in `contentAnalysis`, then hand off to D+E to create `actionSuggestions`.
- **Actions (D+E):** `actionsForType(primaryType)` from contracts gives the three actions. Executors return an `ActionResultDocument` stored in `actionResults.result`; status lives on `actionExecutions`.
- **UI (A):** `SavedItemView` is what `items.list/get/search` return. Build screens from `src/components/ui` and `src/theme` (dark-first). Put a `testID` on every button and input a test touches.
- **Activity (F):** `items.ts` already writes `item_saved`, `item_updated`, `item_deleted` events; F owns reading them and the other event types.
