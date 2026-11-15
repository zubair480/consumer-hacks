This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Project rules (Zapy)

- **Expo Go only.** Use only modules that Expo Go bundles, because the live demo runs on a real iPhone through Expo Go. Add dependencies with `npx expo install <pkg>` and never with npm/yarn/bun add.
- **Convex deploys replace everything.** `npx convex dev --once` replaces the whole function set on the shared dev deployment (pleasant-lark-678). Deploy only from `origin/main` merged with every in-flight Convex branch. Fetch first, merge into a scratch branch or worktree, and push from that. Never push from a branch that would drop another thread's functions.
- **OpenAI is server-side only.** Call OpenAI only from Convex actions, never from the app. The key lives on the deployment (`npx convex env set OPENAI_API_KEY "$OPENAI_API_KEY"`). Read the model from the `OPENAI_MODEL` env var and request JSON output.
- **Ownership on every public function.** Every public Convex query, mutation, and action takes `ownerId` (the device UUID from `src/identity/OwnerProvider.tsx`) and checks ownership through `convex/lib/auth.ts` (`requireUser`, `requireOwnedItem`, `requireOwned`) before reading or writing data. On the client, use `useOwnedQuery` / `useOwnedMutation`.
- **Shared types.** Shared shapes live in `src/shared/contracts.ts`, and changes there are additive only. See the file-ownership table in `README.md`.
- **testIDs.** Every button, input, or control a test touches gets a `testID`.
- **No secrets in git.** Credentials come from env vars. The only committed env value is the public `EXPO_PUBLIC_CONVEX_URL` in `.env`.
- **Keep main runnable.** Before a PR, `npx tsc --noEmit` and `npx expo lint` must pass, and every merge leaves the app launching.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
