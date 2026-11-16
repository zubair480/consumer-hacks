# Limitations

What Zapy does not do today, and why. Checked against `origin/main` at `71a633d`.

## Identity and data

- **No login, device-only identity.** The app creates a random ownerId on first launch and stores it in a file and in expo-secure-store (`src/identity/OwnerProvider.tsx`). Saves belong to that UUID: losing it loses access (Android uninstall normally removes it; the iOS Keychain may keep it across reinstalls), and there is no sync or account recovery.
- **ownerId is a bearer capability, not authentication.** The server trusts the UUID the caller sends (`convex/lib/auth.ts`), so anyone who learns it can act as that device. Fine for a hackathon demo, not for production.
- **Public demo pages.** `/demo/submissions` is unauthenticated and lists every name, email, phone and field of study submitted to `/demo/apply`. Use synthetic profile details in demos.
- **Shared dev backend.** The demo uses one Convex dev deployment (pleasant-lark-678). It is not a production deployment, and deploys from branches would overwrite other work, so only `origin/main` is deployed.

## Capture and import

- **Capture is tucked away.** The + dock button and the "Save a post" pill were removed, so Capture (Link / Text / Photo) is reached from Import's paste fallback or the deep link `zapy:///capture?mode=url`. Most saves arrive through **Pull everything**, X bookmarks and GitHub stars.
- **Sync runs only while the app is open.** X bookmarks and GitHub stars sync when Home gains focus (at most once a minute) or on pull-to-refresh. There is no background or scheduled sync (the crons PR #68 was reverted in #74).
- **X import needs server credentials** (`X_CLIENT_ID`, optionally `X_CLIENT_SECRET`); without them the Import screen says X isn't set up.
- **Hidden import paths.** YouTube liked videos and Share to Zapy (`POST /save`, see [ios-shortcut.md](ios-shortcut.md) and [android-share.md](android-share.md)) have working backends on main, but YouTube is not listed on the Import screen and the share-token card is not mounted, so a new user can't get a token from the current UI. Instagram and LinkedIn imports show as coming soon.
- **No native share extension.** Expo Go can't host one; the Shortcut-based flows above are the workaround.

## Understanding

- **Login-walled and social links need help.** Instagram, TikTok, X, LinkedIn posts and other pages behind a login or bot block often can't be read. The item is saved with status Needs info and asks for a screenshot or pasted text; analysis then continues with what you add.
- **Fetch limits.** Pages are fetched with a 10 s timeout, read up to 1 MB of HTML and 15,000 characters of text; images up to 8 MB. Pages that render only with JavaScript come back as unreadable.
- **GitHub rate limits.** Without a `GITHUB_TOKEN` on the deployment, the unauthenticated GitHub API rate-limits quickly (HTTP 403). The app falls back to the raw README and page metadata, so repo explanations still work, but stars, license and last-push data are missing.
- **AI can be wrong.** Classification and summaries come from an OpenAI model (`OPENAI_MODEL`). For text sources a fact is kept only when the first 120 normalized characters of its quote appear in the fetched text; facts from images rely on the model's visual evidence and can't be checked. Missing facts are reported as missing rather than guessed, but a matched quote can still be misread.

## Agent actions

- **Run it for me** runs a public repo's install and start/test script in an E2B sandbox with a 5-minute timeout. Repos that need secrets, services or a long build won't finish. It needs `E2B_API_KEY`; without it the button is hidden. Verified live on `zubair480/zapy-hello-world` (printed Hello World).
- **Fill it for me** is proven on the hosted demo form `/demo/apply`. The agent fills but never submits on its own; after **Approve**, it clicks Submit only on that demo form, and on any other site you submit in the Browserbase live view within the 8-minute session. Real-world forms with CAPTCHAs (solving is off), logins or multi-page flows can fail or end as blocked. Needs `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`.
- **Add to my calendar** needs `COMPOSIO_API_KEY` and a Google account connected through Composio. The proposal's date comes from the source; when the source has none, approval is blocked until you fill it in. Verified live on the nurses summit demo post.
- **Not covered by automated E2E.** The three agent actions were verified by hand on a phone and by `convex-test` suites, not by Revyl scripts.

## Contextual actions and results

- **Results are documents.** The three contextual actions produce plans, checklists, guides and drafts; they don't book, send or submit anything. "Prepare invitation" asks for confirmation and still only produces text you share yourself.
- **Eligibility uses your profile.** Scholarship eligibility marks a criterion unknown when your profile lacks the field.
- **Executor depth varies.** Scholarship, GitHub, graphic and restaurant executors are dedicated; every other action runs through the generic executor.

## Social Studio and publishing

- **Partly hidden.** Studio opens from **Create post** on an item, and the editor's **Share** opens the publish sheet (direct posting when keys are set). The Create tab is hidden, and the Connected accounts / Send test post card was removed from the You tab.
- **Direct posting only for LinkedIn and X, and only with server keys.** LinkedIn posts when `LINKEDIN_ACCESS_TOKEN` is set (a real test post succeeded on dev earlier: `urn:li:share:7527842989080018944`). X posts only when all four of `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN` and `X_ACCESS_TOKEN_SECRET` are set. The keys belong to one deployment-wide account, so every device posts as that account.
- **Instagram, TikTok and Threads use the share sheet.** The Instagram API PR (#28) is frozen and not merged.
- **Published means provider-confirmed.** A draft is marked Published only when the platform returns a post id; "I posted it" is recorded as user-reported.
- **Truthful drafts only.** Drafts describe what you saved, not experiences you haven't had, but the model can still phrase things loosely, so read a draft before posting it.

## Testing

- **Revyl coverage lags the UI.** The 15 scripts passed 15/15 on tag `phase-1` (`f9f1db1`). The scripts were updated for the new UI (deep link into Capture, Home | You dock), but there has been no full regression run after the latest UI changes (start flow, two-tab dock, Accounts card).
- Unit and integration tests (`npm test`, 21 files, 185 tests) cover the Convex backend and adapters, not React components.

## Platform

- Runs in Expo Go (SDK 58) on iOS and Android; the live demo has used both. Web is not supported.
- Only modules bundled with Expo Go are used, so there are no custom native modules.
