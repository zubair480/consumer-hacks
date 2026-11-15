# Live demo script (7:00 PM PT)

About 5 minutes on **Zubair's Samsung Galaxy A15 in Expo Go**, following the master brief Demo section:

- **Part 1:** three saves, different actions for each, two real executions, and results that stay saved.
- **Share and import:** saving from another app through the Android share sheet, and the Import screen.
- **Part 2 (Social Studio):** LinkedIn and X drafts from a save, Instagram and TikTok drafts from a photo, and a live LinkedIn test post.

Every step lists a fallback line if something is slow. iOS notes are at the end.

## Before going on stage

1. Install **Expo Go** and **HTTP Shortcuts** (by Waboodoo) from the Play Store.
2. Run `npx expo start` on the laptop. On the phone, open **Expo Go** → **Scan QR code** and scan the QR code in the terminal. Android's camera app doesn't open Expo links, so always scan from inside Expo Go. The phone and laptop must be on the same Wi-Fi; if conference Wi-Fi blocks it, restart with `npx expo start --tunnel`.
3. Confirm Home loads ("Turn saves into action").
4. **Profile** tab → **About you**: fill in name, education level "Undergraduate", field of study "Computer Science", country "United States", citizenship "U.S. citizen", GPA "3.6", city "San Francisco" → **Save profile**. This makes eligibility come out met instead of unknown.
5. Put the scholarship text in Google Keep (or any notes app) so you can copy it. Typing it live is too slow.

   > Horizon STEM Scholarship — $5,000 for full-time undergraduates majoring in computer science or engineering at an accredited US university. Minimum GPA 3.2. US citizens or permanent residents. Requirements: a 500-word essay on a technology that will change your community, one letter of recommendation, and an unofficial transcript. Deadline: December 15, 2026.

   (This is a fictional test fixture. Say so if asked.)
6. Put a design image (any UI screenshot or poster) in Google Photos or Gallery.
7. Pre-save one copy of each fixture (scholarship, expo/expo, zunicafe.com, design image) and run one action on each. These are the fallbacks: if anything is slow live, open the pre-saved copy in **Library**.
8. Set up Share to Zapy once by following [android-share.md](android-share.md):
   - Copy the token from **Profile → Share to Zapy**.
   - Build the two HTTP Shortcuts: **Save to Zapy** for links and text, and **Save image to Zapy** for images.
   - Share one Instagram link to test it. You should see the **Saved to Zapy** toast.
9. Run the imports once, so the live taps are only re-syncs:
   - Open **Import saves** from the "Import your X bookmarks" card on Home.
   - Under **GitHub stars**, enter a GitHub username and tap **Sync**.
   - **Connect** **YouTube liked videos** and **X bookmarks** if their rows aren't "Not set up yet" or "Not configured".
10. **Profile → Connected accounts**: LinkedIn should say **Connected**. X says **Share-sheet mode** unless its four keys were set; the steps below work either way.
11. Mirror the phone (scrcpy or the phone's cast option), turn on **Do Not Disturb**, and turn the brightness up.

## Opening (15 s)

Say: "We all save things we never act on: a scholarship, a repo, a restaurant. Zapy turns what you save into what you do."

## Part 1: Save → Understand → Act

To paste on Android, long-press a text field → **Paste**, or use **Paste from clipboard** on the Save screen. That button picks Link or Text for you.

### 1. Scholarship (the main executor)

1. On Home, tap the search pill **Find a save, or save something new**. The **Save something** sheet opens.
2. Copy the Horizon text in Keep. Back in Expo Go, tap **Paste from clipboard**: it switches to **Text** and fills the box. Tap **Save** (top right).
3. The item opens with "Understanding…". When it shows **Ready**, point at the **Facts** tiles: $5,000, GPA 3.2, deadline 2026-12-15. Tap one to show its source quote.
4. Under **Do something**, point at the three actions: Check eligibility, Prepare application, Track verified deadline.
5. Tap the ▶ (Run) button on **Prepare application**. The card shows "Working on it… tap to watch"; tap it, or **View result** when it's done. The result shows a checklist (essay, recommendation letter, transcript), an essay outline and a timeline back from December 15.
6. Tick two checklist items. Say: "These toggles persist in Convex."

Fallback: "Analysis takes a few seconds on a cold start, so here's the one I saved earlier" → **Library** → the pre-saved scholarship → **Previous results**.

### 2. GitHub repo

1. Home → **Find a save, or save something new** → **Link** → type `https://github.com/expo/expo` (or tap the **GitHub repo** chip under **Try an example**) → **Save**.
2. Point at the different actions: Understand project, Extract setup guide, Prepare integration plan. Say: "Same app, different content, different actions."
3. Tap ▶ on **Extract setup guide**. Point out that every command is quoted from the README, with sources listed.

Fallback: "GitHub is rate-limiting us, so it fell back to the raw README; here's the run from earlier" → **Library** → expo/expo → **Previous results**.

### 3. Restaurant or design

1. Save `https://zunicafe.com` as a **Link**. Show the actions: Plan a visit, Find location, Prepare invitation. Don't run one; two executions are enough.
2. Or save a design: **Photo** → **Choose screenshots or photos** (opens the Android photo picker) → pick the design image → **Save**. Show Extract style, Create design brief, Add to moodboard.

Fallback: "The site is slow to respond; here's the copy I saved before" → **Library** → zunicafe.com (or the design image).

### 4. Results stay saved

1. Go to **Home**: the **Done** section lists finished results. Tap the scholarship result; the ticked items are still ticked.
2. Open the **Activity** tab: saves, analysis and finished actions, newest first.

Fallback: if Home is slow to update, open **Library** → the item → **Previous results**.

## Share to Zapy (Android share sheet)

1. In Instagram (or LinkedIn or TikTok), open a post → **Share** → **Send to…** (the HTTP Shortcuts icon; in some apps it's under **More**). If you enabled Direct Share, tap **Save to Zapy** in the top row instead.
2. The **Saved to Zapy** toast appears. Switch to Expo Go: the post is at the top of **Library** and already "Understanding…". Instagram links usually land in Needs info, which asks for a screenshot or pasted text. That's expected; say so.
3. For an image: Google Photos → **Share** → **Send to…**, which runs **Save image to Zapy**.

Say: "No app store build: a free open-source Android app posts the share to our Convex endpoint with a personal token."

Fallback: "Conference Wi-Fi is slow, so here's the one I shared earlier" → **Library** → the pre-shared post. If the toast says "failed with status code 401", the token was rotated: paste the new one into both shortcuts' **Authentication → Token**.

## Import screen

1. Home → **Import your X bookmarks** card → **Import saves**.
2. **GitHub stars** → **Sync**. The line under the row shows what came in.
3. **YouTube liked videos** and **X bookmarks** → **Connect**, or **Sync** if you connected them in prep. Sign-in opens in a Chrome Custom Tab and returns to Expo Go. **Import now** at the top syncs every connected source.
4. The **Instagram saved** and **LinkedIn saved** rows say "Share a post → Send to… (HTTP Shortcuts)". **Set up** opens Profile → Share to Zapy.

Fallback: "Sign-in is slow on this network; these came in from the sync I ran before the demo" → **Library**. If YouTube shows "Not configured" or X shows "Not set up yet", skip it and say the server keys aren't set in this build.

## Part 2: Social Studio

### From a save: GitHub → LinkedIn + X

1. Open the expo/expo save (from **Library** or Home) → **Create post**.
2. **Where to post** opens with the recommended platforms preselected. Make sure **LinkedIn** and **X** are selected. Optionally add a line under "Anything to add?" Then tap **Write 2 drafts**.
3. The editor opens with a **LinkedIn** tab and an **X** tab. It shows "Writing your drafts…" until both are ready. Switch tabs to show they differ: a longer LinkedIn post, and an X post or thread with each post under 280 characters. Scroll to **Facts used**, and point out the wording: it's a repo you found, never one you built.
4. On the **X** tab, change a line → **Save edit** ("Saved as a new version."). Switch to **LinkedIn** → **Rewrite** → confirm **Rewrite**. Back on X, your edit is still there.
5. On X, tap **Copy**, then **Share**:
   - In share-sheet mode, the sheet says X isn't connected and offers **Open in X**, then **I posted it**.
   - The pill shows Awaiting user action, never Published.
   - Tap **Close**.
   - Don't tap **Confirm and publish** on the LinkedIn draft unless you want it on the real profile.

Fallback: "Generation is slow right now; these drafts were written earlier" → **Create** tab → **Recent saves** → open the GitHub save's drafts.

### From a new photo: Instagram + TikTok

1. **Create** tab → **New photo** → **Choose from library** (Android photo picker) or **Take a photo** (Android camera). Under "Where or what is this?", type one line, e.g. "Found this cafe on a walk and want to come back".
2. Under **Platforms**, select **Instagram** and **TikTok** → **Create drafts**. The button steps through "Uploading photo…", "Looking at your photo…" and "Writing drafts…".
3. Show the photo facts ("Source: the photo only"), the Instagram caption card, and the TikTok card with Hook, Shots, Voiceover, On-screen text and Caption. **Edit and share drafts** opens the same editor, and **Share** there opens the Android share sheet.

Fallback: "The photo is still uploading on conference Wi-Fi; here's one from earlier" → **Create** tab → the earlier photo drafts.

### Live posting proof: LinkedIn test post

1. **Profile** tab → **Connected accounts** → LinkedIn shows **Connected** → **Send test post**.
2. The sheet shows "Testing Zapy <time>" and warns "Posts publicly to your LinkedIn account" → **Confirm**.
3. It shows "Posted to LinkedIn" with the post id. **View post** opens it in the browser or the LinkedIn app.

Say: "That's a real post id from LinkedIn. Only that marks something Published; for Instagram, TikTok and Threads you post it yourself through the share sheet."

Fallback: if LinkedIn errors or is slow, show the earlier confirmed post (`urn:li:share:7527842989080018944`) and say "LinkedIn is rate-limiting us; this one went out earlier today."

## Closing message (15 s)

"Zapy turns what you save into what you do: it reads the source, picks actions that fit, and runs them into results you keep, without making anything up, and it turns saves into posts that only go out when you confirm them. Built in a day with Expo, Convex and OpenAI."

## If something breaks

- **App stuck loading:** swipe Expo Go away from Recents and scan the QR code again, or shake the phone → **Reload**.
- **"Something went wrong" in Expo Go after the laptop's IP changed:** stop `npx expo start`, restart with `--tunnel`, and scan again.
- **HTTP Shortcuts shows a list instead of running one:** pick **Save to Zapy**; another shortcut also accepts shared text.
- **Network down:** walk through the pre-saved items and results in **Library**. They need the network too, so keep a screen recording of the full run as the last resort.
- **Wrong classification:** say "The model can be wrong, so every fact links to its source", and open the evidence.

## iOS notes

The same script works on an iPhone in Expo Go, with these differences:

- Scan the QR code with the Camera app.
- Paste from Notes.
- Sharing from other apps uses the Zapy Shortcut instead of HTTP Shortcuts; see [ios-shortcut.md](ios-shortcut.md).
- The Instagram and LinkedIn import rows say "Share a post → Zapy Shortcut".
- **Copy** and **Share** open the iOS share sheet.
