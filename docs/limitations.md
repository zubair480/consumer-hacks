# Limitations

What Zapy does not do today, and why.

## Identity and data

- **No login, device-only identity.** The app creates a random ownerId on first launch and stores it in expo-secure-store (a file fallback is used where the keychain is unavailable, such as unsigned simulator builds). Saves belong to that device: deleting the app or switching phones loses access, and there is no sync or account recovery.
- **Shared dev backend.** The demo uses one Convex dev deployment (pleasant-lark-678). It is not a production deployment.

## Capture and understanding

- **Login-walled and social links need help.** Instagram, TikTok, X, LinkedIn posts and other pages behind a login or bot block can't be read. The item is saved with status Needs info and asks for a screenshot or pasted text; analysis then continues with what you add.
- **Fetch limits.** Pages are fetched with a 10 s timeout, read up to 1 MB of HTML and 15,000 characters of text; images up to 8 MB. Pages that render only with JavaScript come back as unreadable.
- **GitHub rate limits.** Without a `GITHUB_TOKEN` on the deployment, the unauthenticated GitHub API rate-limits quickly (HTTP 403). The app falls back to the raw README and page metadata, so repo explanations still work, but stars, license and last-push data are missing.
- **No native share extension.** Saving from another app's share sheet isn't supported in Expo Go; paste the link or text into Capture instead.
- **AI can be wrong.** Classification and summaries come from an OpenAI model (`OPENAI_MODEL`). Facts are only kept when their evidence quote appears in the source, and missing facts (a deadline, a price, an address) are reported as missing rather than guessed, but a correct quote can still be misread. Check results before acting on them.
- **Analysis speed** depends on the source and OpenAI; typical runs took 1–6 s in testing, longer for large pages and images.

## Actions and results

- **Actions don't act for you.** Results are plans, checklists, guides and drafts. The app doesn't submit applications, book tables or send invitations, and never marks an external action complete. "Prepare invitation" asks for confirmation and still only produces text you share yourself.
- **Eligibility uses your Profile.** Scholarship eligibility marks a criterion unknown when your Profile lacks the field; fill in Profile for a fuller check.
- **Deadline tracking** only uses a deadline found in the source; there are no push notifications or calendar writes.
- **Executor depth varies.** Scholarship and GitHub executors are the most complete; graphic, restaurant, recipe and code-snippet executors work; other types (job, event, travel, product, research, tutorial, general) use generic actions.

## Social Studio and publishing

- **Direct posting only for LinkedIn and X, and only with server keys.** LinkedIn posts when `LINKEDIN_ACCESS_TOKEN` is set on the Convex deployment (it is on dev, and a real test post succeeded: `urn:li:share:7527842989080018944`). X posts only when all four of `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN` and `X_ACCESS_TOKEN_SECRET` are set; until then it stays in share-sheet mode. The keys belong to one deployment-wide account, so every device posts as that account; there is no per-user OAuth sign-in.
- **Instagram, TikTok and Threads use the share sheet.** Zapy opens the app or the share sheet and you post yourself. A pull request for the Instagram API is frozen and not merged.
- **Published means provider-confirmed.** A draft is marked Published only when the platform returns a post id. "I posted it" after the share sheet is recorded as user-reported, and opening the share sheet only moves a draft to Awaiting user action.
- **Posting is public and needs your confirmation.** Confirm and publish and Send test post both post publicly to the connected account. Nothing is posted without that tap, and there is no scheduling.
- **No passwords or scraping.** Connected accounts show booleans from the server only; tokens never reach the app.
- **Truthful drafts only.** Drafts describe what you saved, not experiences you haven't had: "Found this restaurant and want to try it", never "I had the best dinner here"; a bookmarked repo is never presented as something you built. The model can still phrase things loosely, so read a draft before posting it.
- **Media.** Drafts suggest media ideas, and TikTok gets a storyboard and script. The app does not edit or render video, and only photos are analyzed for the photo flow.

## Platform

- Built for iOS through Expo Go (SDK 58). Android and web are not tested.
- Only modules bundled with Expo Go are used, so there are no custom native modules.
