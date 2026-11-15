# YouTube liked-videos import: Google setup

Zapy imports a user's YouTube liked videos through a server-side Google OAuth 2.0 web flow. Convex holds the client secret and the tokens; the app never sees either. Until the two env vars below are set, the YouTube row on the Import screen shows **Not configured** and its Connect button is disabled.

Redirect URI (must match exactly, no trailing slash):

```
https://pleasant-lark-678.convex.site/oauth/google/callback
```

For a different Convex deployment, use `<CONVEX_SITE_URL>/oauth/google/callback`, where the site URL is the deployment's `.convex.site` address.

## 1. Google Cloud project

1. Open https://console.cloud.google.com/ and sign in.
2. Use the project picker at the top, then **New project**. Name it (for example `Zapy`) and create it. Make sure it is selected afterwards.

## 2. Enable the YouTube Data API v3

1. Go to **APIs & Services → Library**.
2. Search for **YouTube Data API v3**, open it, and click **Enable**.

Without this, sync fails with "The YouTube Data API v3 is not enabled for this Google Cloud project."

## 3. OAuth consent screen (Testing)

1. Go to **APIs & Services → OAuth consent screen** (shown as **Google Auth Platform → Branding / Audience / Data access** in the newer console).
2. User type: **External**. App name `Zapy`, a support email, and a developer contact email. Save.
3. Scopes / **Data access**: add `https://www.googleapis.com/auth/youtube.readonly`.
4. Publishing status: leave it in **Testing**.
5. **Test users** (under **Audience**): add the Google account of every person who will connect YouTube (for the demo, the presenter's account). Only listed accounts can sign in while the app is in Testing; anyone else gets "access blocked".

Note: in Testing, Google expires refresh tokens after 7 days. When that happens the row shows "YouTube access expired or was revoked. Reconnect YouTube." and the user taps Disconnect, then Connect.

## 4. OAuth client (Web application)

1. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID** (or **Google Auth Platform → Clients → Create client**).
2. Application type: **Web application**. Name it `Zapy Convex`.
3. **Authorized redirect URIs → Add URI**: `https://pleasant-lark-678.convex.site/oauth/google/callback`
4. Leave **Authorized JavaScript origins** empty.
5. Create, then copy the **Client ID** and **Client secret**.

## 5. Convex env vars

Set both on the deployment (the deployment owner does this; never commit them):

```bash
npx convex env set GOOGLE_CLIENT_ID "<client id>.apps.googleusercontent.com"
npx convex env set GOOGLE_CLIENT_SECRET "<client secret>"
```

`CONVEX_SITE_URL` is provided by Convex automatically and is used to build the redirect URI.

## 6. Check it

1. Open Zapy in Expo Go → Import. The YouTube row should read **Not connected** with an enabled **Connect**.
2. Tap Connect, pick a test-user Google account, and allow access. The browser returns to Zapy and a sync runs right away.
3. Each sync imports up to 20 new liked videos, newest first. Videos already in Zapy (by video id, or pasted earlier as a youtube.com / youtu.be link) are skipped.

## How it works

- `api.imports.youtube.startConnect` stores a single-use state and PKCE verifier in `importOAuthStates` and returns the consent URL (`youtube.readonly`, `access_type=offline`, `prompt=consent`).
- `/oauth/google/callback` in `convex/http.ts` consumes the state (expired after 15 minutes, refused if replayed or unknown), exchanges the code at `https://oauth2.googleapis.com/token`, stores the tokens in `importConnections`, and redirects back to `…/--/import?youtube=connected`.
- `api.imports.youtube.sync` refreshes the access token when it is within a minute of expiry, reads `GET /youtube/v3/videos?myRating=like&part=snippet`, and imports through the shared import pipeline (`importForUser`, the same dedupe as `importBatch`), with the title, channel, and description as text and the thumbnail as the image.
- Code: `convex/imports/youtubeClient.ts` (Google/YouTube HTTP), `convex/imports/youtube.ts` (Convex functions), `src/components/YouTubeSourceRow.tsx` (UI).
