# Live demo script (7:00 PM PT)

About 5 minutes on a real iPhone in Expo Go, following the master brief Demo section: Part 1 (three saves, different actions, two real executions, results saved), Part 2 (Social Studio). Every step lists a fallback line if something is slow.

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

## Part 2: Social Studio (in progress, confirm before the demo)

TODO (Captain): replace these steps with the real screen and button names once K merges; cut Part 2 to one sentence if it isn't on main by 6 PM.

1. Open the expo/expo save → **Create post** → select **LinkedIn** and **X** → Generate.
2. Show that the two drafts are different: a longer LinkedIn post and an X thread under 280 characters each. Point out the wording: about a repo you found, never one you built.
3. Edit the X draft, then regenerate LinkedIn. The X edit stays.
4. Tap **Share** on LinkedIn: the native share sheet opens. Close it and point out the status "Awaiting user action". Say: "We never mark something Published without the platform confirming it."
5. New photo flow: **Create** → pick a photo → add context → **Instagram** + **TikTok** → Generate. Show the Instagram caption and the TikTok storyboard.

Fallback: "Generation is slow right now; these drafts were generated earlier" → open the pre-made drafts. If Social Studio isn't merged: "Social Studio is the next step: the same saves become platform-specific drafts you share yourself."

## Closing message (15 s)

"Zapy turns what you save into what you do: it reads the source, picks actions that fit, and runs them into results you keep, without making anything up and without posting anything for you. Built in a day with Expo, Convex and OpenAI."

## If something breaks

- App stuck on the loading spinner: close and reopen it in Expo Go.
- Network down: stay in Library and walk through the pre-saved items and results; they need the network too, so keep a screen recording of the full run as the last resort.
- Wrong classification: "The model can be wrong, so every fact links to its source"; open the evidence.
