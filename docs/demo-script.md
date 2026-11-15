# Live demo script (7:00 PM PT)

About 5 minutes on a real iPhone in Expo Go, following the master brief Demo section: Part 1 (three saves, different actions, two real executions, results saved), Part 2 (Social Studio: LinkedIn + X from a save, Instagram + TikTok from a photo, and a live LinkedIn test post). Every step lists a fallback line if something is slow.

Demoing on an Android phone? Follow the same script with the changes in [Android demo](#android-demo-expo-go) below.

## Before going on stage

1. Open the app in Expo Go from `npx expo start` and confirm Home loads with your saves.
2. Fill in Profile and save it: name, education level "Undergraduate", field of study "Computer Science", country "United States", citizenship "U.S. citizen", GPA "3.6", city "San Francisco". This makes eligibility come out met instead of unknown.
3. Put the scholarship text in Notes so you can copy it (typing it live is too slow):

   > Horizon STEM Scholarship — $5,000 for full-time undergraduates majoring in computer science or engineering at an accredited US university. Minimum GPA 3.2. US citizens or permanent residents. Requirements: a 500-word essay on a technology that will change your community, one letter of recommendation, and an unofficial transcript. Deadline: December 15, 2026.

   (This is a fictional test fixture. Say so if asked.)
4. Have a design image in Photos (any UI screenshot or poster).
5. Pre-save one copy of each fixture (scholarship, expo/expo, zunicafe.com, design image) and run one action on each. These are the fallbacks: if anything is slow live, open the pre-saved copy in Library.
6. Mirror the phone, silence notifications, brightness up.

## Opening (15 s)

Say: "We all save things we never act on: a scholarship, a repo, a restaurant. Zapy turns what you save into what you do."

## Part 1: Save → Understand → Act

### 1. Scholarship (the main executor)

1. Tap **Save** on Home → Capture opens → switch to **Text**.
2. Paste the Horizon text → **Save**. The item detail opens showing "Understanding…".
3. When it turns Ready, point at the facts: $5,000, GPA 3.2, deadline 2026-12-15, each with its source quote (tap one to expand the evidence).
4. Point at the three actions: Check eligibility, Prepare application, Track verified deadline.
5. Tap **Prepare application** → **Run**. The result shows a checklist (essay, recommendation letter, transcript), an essay outline and a timeline back from December 15.
6. Tick two checklist items. Say: "These toggles persist in Convex."

Fallback: "Analysis takes a few seconds on a cold start, so here's the one I saved earlier" → Library → the pre-saved scholarship → its result.

### 2. GitHub repo

1. **Save** → **Link** → `https://github.com/expo/expo` → **Save** (or tap the "GitHub repo" example chip).
2. Point at the different actions: Understand project, Extract setup guide, Prepare integration plan. Say: "Same app, different content, different actions."
3. Run **Extract setup guide**. Point out that every command is quoted from the README, with sources listed.

Fallback: "GitHub is rate-limiting us, so it fell back to the raw README; here's the run from earlier" → Library → expo/expo → result.

### 3. Restaurant or design

1. **Save** → **Link** → `https://zunicafe.com` → **Save**. Show the actions: Plan a visit, Find location, Prepare invitation. Don't run one (two executions are enough).
2. Or: **Save** → **Photo** → pick the design image → **Save**. Show Extract style, Create design brief, Add to moodboard.

Fallback: "The site is slow to respond; here's the copy I saved before" → Library → zunicafe.com (or the design image).

### 4. Results stay saved

1. Go **Home**: point at Completed outcomes. Tap the scholarship result; the ticked checklist items are still ticked.
2. Open **Activity**: saved, analyzed and action-completed events in order.

Fallback: if Home is slow to update, open Library → item → previous results.

## Part 2: Social Studio

Prep: check **Profile → Connected accounts**. LinkedIn should say Connected, and X will say Share-sheet mode unless its four keys were set. The steps below work either way.

### From a save: GitHub → LinkedIn + X

1. Open the expo/expo save (Library or Home) → tap **Create post**.
2. **Where to post** opens with the recommended platforms preselected. Make sure **LinkedIn** and **X** are selected, optionally add a line under "Anything to add?", and tap **Write 2 drafts**.
3. The editor opens with a **LinkedIn** and an **X** tab, and the bar says "Writing your drafts…" until both are ready. Switch tabs to show that they differ: a longer LinkedIn post, and a short X post or thread with each post under 280 characters. Scroll to **Facts used** to show where the facts came from, and point out the wording: a repo you found, never one you built.
4. On the **X** tab, change a line → **Save edit** ("Saved as a new version."). Switch to **LinkedIn** → **Rewrite** → confirm **Rewrite** ("Other platforms and your saved versions stay as they are."). Back on X, your edit is still there.
5. On X, tap **Copy**, then **Share**. In share-sheet mode the sheet says X isn't connected and offers **Open in X**, then **I posted it**. The pill shows Awaiting user action, never Published. Tap **Close**. Don't tap **Confirm and publish** on the LinkedIn draft unless you want it on the real profile.

Fallback: "Generation is slow right now; these drafts were written earlier" → **Create** tab → open a recent draft.

### From a new photo: Instagram + TikTok

1. **Create** tab → **New photo** → **Choose from library** (or **Take a photo**) → under "Where or what is this?" type one line, e.g. "Found this cafe on a walk and want to come back".
2. Under **Platforms**, select **Instagram** and **TikTok** → **Create drafts**. The button steps through "Uploading photo…", "Looking at your photo…" and "Writing drafts…".
3. Show "What's in the photo · facts" (Source: the photo only), the Instagram caption card, and the TikTok card with Hook, Shots, Voiceover, On-screen text and Caption. **Edit and share drafts** opens the same editor.

Fallback: "The photo is still uploading on conference Wi-Fi; here's one from earlier" → **Create** tab → recent drafts.

### Live posting proof: LinkedIn test post

1. **Profile** tab → **Connected accounts** → LinkedIn shows **Connected** → **Send test post**.
2. The sheet shows "Testing Zapy <time>" and warns "Posts publicly to your LinkedIn account" → **Confirm**.
3. It shows "Posted to LinkedIn" with the post id → **View post** opens it. Say: "That's a real post id from LinkedIn. Only that marks something Published; for Instagram, TikTok and Threads you post it yourself through the share sheet."

Fallback: if LinkedIn errors or is slow, show the earlier confirmed post (`urn:li:share:7527842989080018944`) and say "LinkedIn is rate-limiting us; this one went out earlier today."

## Closing message (15 s)

"Zapy turns what you save into what you do: it reads the source, picks actions that fit, and runs them into results you keep, without making anything up, and it turns saves into posts that only go out when you confirm them. Built in a day with Expo, Convex and OpenAI."

## Android demo (Expo Go)

Use this section when the demo phone is Android. Everything above stays the same except the points below; the step numbers refer to the iOS script.

### Before going on stage (Android)

1. Install **Expo Go** and **HTTP Shortcuts** (by Waboodoo) from the Play Store.
2. Run `npx expo start` on the laptop, open **Expo Go** on the phone and tap **Scan QR code**, then scan the QR code in the terminal. (Android's camera app doesn't open Expo links; scan from inside Expo Go.) The phone and laptop must be on the same Wi-Fi; if conference Wi-Fi blocks it, restart with `npx expo start --tunnel`.
3. Profile, the scholarship text and the pre-saved fixtures: same as steps 2–5 above. Keep the scholarship text in Google Keep (or any notes app) and the design image in Google Photos or Gallery.
4. Set up Share to Zapy once by following [android-share.md](android-share.md): copy the token from **Profile → Share to Zapy**, then build the two HTTP Shortcuts (**Save to Zapy** for links and text, **Save image to Zapy** for images). Share one Instagram link to test it; you should see the **Saved to Zapy** toast.
5. On the **Import** screen, enter your GitHub username in **GitHub stars** and tap **Sync** once, and connect **YouTube liked videos** and **X bookmarks** if their keys are set, so the live taps are only re-syncs.
6. Mirror the phone (scrcpy or the phone's cast option), turn on **Do Not Disturb**, brightness up.

### Part 1 on Android

- Pasting: long-press the text field → **Paste**. The Capture flow and buttons are the same as on iOS.
- Photo picks open the Android photo picker instead of the iOS one.

### Share to Zapy (Android share sheet)

1. Open Instagram (or LinkedIn or TikTok) on a post → **Share** → **Send to…** (the HTTP Shortcuts icon; on some apps it's under **More**). If you enabled Direct Share, tap **Save to Zapy** in the top row instead.
2. The **Saved to Zapy** toast appears. Switch to Expo Go: the post is at the top of Library and already "Understanding…".
3. For an image: Google Photos → **Share** → **Send to…**, which runs **Save image to Zapy**.

Say: "No app store build: a free open-source Android app posts the share to our Convex endpoint with a personal token."

Fallback: "Conference Wi-Fi is slow, so here's the one I shared earlier" → Library → the pre-shared Instagram post. If the toast says "failed with status code 401", the token was rotated: paste the new one into both shortcuts' **Authentication → Token**.

### Import screen

1. Home → **Import saves** → **Import saves** screen.
2. **GitHub stars**: tap **Sync**. The result line under the row shows what came in.
3. **YouTube liked videos** and **X bookmarks**: tap **Connect** (or **Sync** if connected in prep). Sign-in opens in a Chrome Custom Tab and returns to Expo Go.
4. The Instagram and LinkedIn rows say "Share a post → Send to… (HTTP Shortcuts)"; **Set up** opens Profile → Share to Zapy.

Fallback: "Sign-in is slow on this network; these came in from the sync I ran before the demo" → Library. If YouTube or X shows "Not configured", skip it and say the server keys aren't set in this build.

### Part 2 on Android

- **Copy** and **Share** open the Android share sheet. For X in share-sheet mode, the sheet offers **Open in X**, then **I posted it**, the same as on iOS.
- **Take a photo** opens the Android camera; **Choose from library** opens the Android photo picker.

### If something breaks (Android)

- App stuck loading: swipe Expo Go away from Recents and scan the QR code again, or shake the phone → **Reload**.
- "Something went wrong" in Expo Go after the laptop's IP changed: stop `npx expo start`, restart with `--tunnel`, and scan again.
- HTTP Shortcuts shows a list of shortcuts instead of running one: pick **Save to Zapy**; another shortcut also accepts shared text.

## If something breaks

- App stuck on the loading spinner: close and reopen it in Expo Go.
- Network down: stay in Library and walk through the pre-saved items and results; they need the network too, so keep a screen recording of the full run as the last resort.
- Wrong classification: "The model can be wrong, so every fact links to its source"; open the evidence.
