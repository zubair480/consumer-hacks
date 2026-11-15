# ZAPY: Creative Direction and Design System (v4, the binding rulebook)

These rules replace every earlier UI spec. They combine refA ("Let's Learn Now!": warmth, pastel cards, doodles, pill bars) and refB ("Learning courses by top mentors": editorial headlines, stacked wavy color blocks, holographic accents, ink pills).

## 0. Concept and principles
- **Concept:** a pastel scrapbook with a bold editorial voice. It should feel like a sunny, tactile notebook of things you saved, with magazine-grade type telling you what to do next.
- **Mood words:** confident, playful, tactile, editorial, optimistic, crisp.
- **Never:** techy, neon, glassmorphism, dark mode, gradients on buttons, sparkle "AI" icons, emoji, generic dashed empty boxes.
- **Principles:**
  1. **One focal point per screen.** Either the hero card or the display headline, never both competing.
  2. **Color means content type.** Every saved item owns a pastel, and that pastel follows it everywhere: chip, card, detail header, result band.
  3. **Ink means action.** Every primary tappable is ink #111111. Pastels are never buttons.
  4. **Generous negative space.** At least 28pt between sections, and no section touches another.
  5. **Motion explains cause and effect.** Things grow from where you tapped and slide from where they live.

## 1. Grid and spacing
- **8pt system:** 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 56. No off-scale values.
- **Layout grid** on 393pt width: 4 columns, 20pt outer margins, 12pt gutters.
- **Vertical rhythm:** 28pt between sections, 12pt from a section header to its content, 10pt between list items.
- **Touch targets:** at least 44×44pt.
- **Scroll content:** 120pt bottom padding so the floating nav never covers content.

## 2. Typography: a grotesque display face paired with a geometric sans
- **Display:** Archivo Black (`@expo-google-fonts/archivo-black`), ALL CAPS, tracking −0.5, leading 100%.
  - Sizes: XL 40, L 34.
  - Use: ONE screen-level statement per screen.
  - Keep each headline to 2–3 lines, with manual line breaks so there are no widows.
- **Text:** Plus Jakarta Sans (`@expo-google-fonts/plus-jakarta-sans`). Load both fonts with `useFonts` and hold the splash screen until they're ready.

| Style | Size / line height / weight | Use |
|---|---|---|
| Title 1 | 30 / 36 / 800 | Home screen title, sentence case |
| Title 2 | 26 / 30 / 800 | Card titles |
| Title 3 | 22 / 26 / 800 | Wave block names |
| Headline | 18 / 24 / 800 | Section headers |
| Body | 15 / 22 / 500 | Paragraphs |
| Callout | 14 / 20 / 700 | Button and pill-bar labels |
| Footnote | 12 / 16 / 500 | Meta in Ink-2 |
| Overline | 11 / 14 / 800 | UPPERCASE, tracking +0.9: labels and pills |

- **Counts:** tabular lining numerals (`fontVariant: ['tabular-nums']`).
- **Marker highlight:** one keyword per display headline sits on a pastel block. Radius 10, padding 2×10, rotated −1.5°, for a hand-made feel.
- **Measure:** titles at most 32 characters per line. Never put grey text on a pastel.

## 3. Color system (by role)
| Role | Value |
|---|---|
| Canvas | #FFFFFF |
| Ink (text and primary actions) | #111111 |
| Ink-2 (secondary text) | #5B5B63 |
| Ink-3 (placeholder, tertiary) | #9A9AA3 |
| Surface grey (inputs, idle chips) | #F4F4F5 |
| Hairline | #ECECEC |

- **Pastels** are fills only, never text color:

| Pastel | Hex | Content types |
|---|---|---|
| Butter | #F8E58C | scholarship, job, application |
| Lavender | #D9CCFF | GitHub, code, tutorial |
| Peach | #FFD3C2 | restaurant, recipe, travel |
| Mint | #A8EBD9 | graphic, product |
| Lime | #E8F59A | event |
| Cyan | #A6E6F0 | research, general |

- **Holographic gradient** (accent only): 135°, #FFD1E3 → #FFF2B3 → #BFF0E6 → #D3DAFF. Allowed in exactly three places:
  - the 140pt top-of-screen fade (70% opacity, fading to white)
  - the nav "+" fill
  - the 6pt strip at the bottom of wave blocks
- **Semantic colors:** success #2BB673 (dots only), error #E5484D (small text or dots only). Warnings use a butter fill with ink text.
- **Contrast:** all text at least 4.5:1.

## 4. Shape, elevation and borders
- **Radius scale:** XS 10 (marker) · S 14 (icon squircles) · M 20 (list rows) · L 28 (hero and feature cards) · Pill 999.
- **Elevation** (all shadows use color #111111):

| Level | Opacity | Radius | Y offset | Use |
|---|---|---|---|---|
| E0 | none (hairline only) | — | — | Default cards |
| E1 | 0.06 | 12 | 4 | Search pill, focused inputs |
| E2 | 0.12 | 18 | 8 | Selected tile, carousel focus card |
| E3 | 0.25 | 20 | 10 | Nav capsule, toasts |

- **Borders:** hairline 1pt #ECECEC · focus ring 1.5pt ink · selected 2pt ink.

## 5. Iconography and illustration
- **Icons:** one family only, Ionicons outline (`@expo/vector-icons`). Rounded caps. 22pt in UI, 18pt inline, 28pt in tiles. The active state uses the filled variant.
- **Doodles** (refA's illustrations, translated):
  - Line art in ink, 2.5pt stroke, rounded caps and joins, drawn with react-native-svg.
  - Shapes: 4-point sparkle, 8-ray burst, S-squiggle, loop, curved arrow, open circle.
  - Placement: corners of feature cards at 60–120% scale, rotated −12° to +12°, never over text, at most one pastel fill per cluster.
- **Avatar stack:** 28pt circles with a 2pt white stroke, overlapping by −8pt, initials 11/800. The last circle is ink with white "+N".

## 6. Components: anatomy and states
The states covered are default / pressed / disabled / focus / loading / selected.

- **Primary button:**
  - Default: 54 tall, pill, ink fill, Callout 15/700 white label, optional trailing 36pt white circle holding an ink arrow or play glyph.
  - Pressed: scale 0.97 plus 6% darker.
  - Disabled: ink at 25% opacity, no shadow.
  - Loading: label changes to "Working…" and the circle becomes a spinning ring.
- **Secondary button:** white fill, 1pt ink border, ink label.
- **Pill bar** (refA "Start Learning"):
  - White, 52 tall, radius 26, inset 12 inside a pastel card.
  - Leading Callout label, trailing 40pt ink circle with a white play glyph.
  - Pressed: the bar goes to 0.98 and the circle to 0.90, then springs back.
- **Search field:**
  - 50 tall, surface grey, pill.
  - Leading 18pt icon in Ink-3, Body placeholder in Ink-3.
  - Trailing 36pt white circle (E1) with a filter icon.
  - Focus: background turns white with a 1.5pt ink ring and E1.
- **Chip** (refA "UI Design 23"):
  - 32 tall, pill, horizontal padding 14, pastel fill, Overline-weight 12/700 ink label, count at 60% ink.
  - Selected: ink fill, white label, count in a white mini pill.
  - Pressed: 0.95.
- **Hero type card** (signature):
  - 353×236, or 300 wide in a carousel. Radius L, pastel fill, padding 20.
  - Title 2 at top left: at most 2 lines, 60% of the width.
  - Avatar stack 12pt below the title.
  - Top right: a doodle cluster plus a 96pt ink-outlined circle with the type icon at 40pt.
  - Pill bar pinned to the bottom with the top action, e.g. "Check eligibility ▶".
  - Carousel: the focused card sits at scale 1 with E2; side cards at 0.92 scale and 0.6 opacity; snap.
- **Wave block** (signature):
  - Full width, 96 tall.
  - Top edge is an organic sine path: 2 crests, amplitude 10.
  - Stacked with −14 overlap; later blocks sit on top.
  - Pastel fill, 6pt holographic strip along the bottom.
  - Left: overline "N SAVES" over Title 3. Right: count in Archivo Black 30 over the overline "SAVES".
- **List row:**
  - 72 tall, white, radius M, hairline.
  - Leading 48pt pastel squircle (radius S) holding a 22pt ink icon.
  - Title 15/700, Footnote meta, trailing chevron 16pt in Ink-3.
  - Pressed: surface grey background, scale 0.98.
- **Action card:**
  - White, radius 22, hairline, padding 16.
  - Leading 36pt pastel numeral badge (14/800). Title 16/800. One line at 13/500 Ink-2. Trailing 40pt ink play circle.
  - Pressed: 0.97.
  - Running: the play circle becomes a progress ring and the label reads "Working…".
- **Fact tile:**
  - 2-column grid with a 10pt gap. Radius 18, pastel at 50%, padding 14.
  - Overline label in Ink-2, value 15/700.
  - Tap flips the tile (rotateY 180°, 300ms) to show the source quote in Body italic.
- **Status pill** (24 tall):

| Status | Look |
|---|---|
| Understanding… | Surface grey with a shimmer and 3 bouncing dots |
| Ready | Mint with a green dot |
| Needs info | Butter |
| Failed | Peach with a red dot |

- **Toast:** ink pill, 44 tall, white 14/700 label with a white check circle. Drops in from the top on a spring, E3, auto-hides after 2s.
- **Checkbox:** 26pt circle with a 2pt ink stroke. Checked: pastel fill with a 2.5pt ink check.
- **Label pill** (refB "MENU"): 28 tall, ink fill, white Overline label. It sits above the display headline.
- **Floating nav capsule:**
  - Size and placement: 64 tall, 20pt side margins, 12pt above the safe area, radius 32, ink fill, E3.
  - Inactive tabs: white outline icons at 55% opacity, no labels.
  - Active tab: a pastel pill (Home butter, Library lavender, Activity mint, Profile peach) expands behind the icon to show its label (13/800 ink). The icon turns filled ink.
  - One shared indicator slides and resizes between tabs on the bouncy spring.
  - Center "+": a 56pt circle raised 10pt, holographic fill, 3pt ink ring, ink "+" glyph.
    - On press it rotates 45° into "×" as Capture opens.
    - With 0 saves, a pulse ring plays every 2.5s.
  - Scroll: the capsule hides on scroll down and returns on scroll up.
  - The Activity tab shows a 7pt butter dot when a new result is ready.

## 7. Motion language (react-native-reanimated worklets only, 60fps)
- **Durations:** micro 120ms (press) · short 200ms (crossfade) · medium 280ms (enter) · long 450ms (sheet) · celebratory 600ms (burst).
- **Easing:** enter `Easing.out(Easing.cubic)`, exit `Easing.in(Easing.cubic)`.
- **Springs:**

| Name | Damping | Stiffness | Use |
|---|---|---|---|
| snappy | 18 | 320 | Presses |
| bouncy | 12 | 220 | Nav pill, toasts, the Save button enabling |
| gentle | 20 | 140 | Sheets, carousel settling |

- **Choreography on screen enter:** header → title → search → chips → cards, staggered 50ms. Each element moves translateY 14 → 0 with opacity 0 → 1 (medium, out-cubic).
- **Continuity:**
  - Opening an item: its detail header starts at 0.96 scale and fades in, using the same pastel as the tapped card.
  - Capture and Result open as sheets on the gentle spring, with a 40% ink scrim behind.
- **Signature moments:**
  - **Ready burst:** 6 doodle sparks scale out and fade around the status pill (600ms), and the card's color floods in from the left (300ms).
  - **Run morph:** the play circle becomes a ring, then the result sheet slides up.
  - **Count-ups:** numbers count up over 600ms.
  - **Typewriter:** example chips fill the input at 12ms per character.
  - **Tile selection:** the selected tile lifts (1.03 scale, E2) while the others dim to 70%.
- **Loading:** skeleton blocks in surface grey with a pastel shimmer sweeping left to right every 1.2s.
- **Reduce Motion:** opacity fades only. No translate, no stagger, no burst.

## 8. Haptics (expo-haptics)
- **Selection:** tab changes, chip selection.
- **Light impact:** primary button presses, checkbox, Run.
- **Success notification:** Ready, result done, "Saved to Zapy".
- **Warning notification:** invalid link.

## 9. Screen compositions (top to bottom)
- **Home (populated):**
  1. Header: "Hi, Zubair" / "N saves", with an avatar on the right
  2. Title 1: "Your saves, ready to act."
  3. Search
  4. Chips
  5. "Ready for you" hero carousel
  6. "Recently saved" header with "See all"
  7. List rows
- **Home (empty, how the demo opens):**
  1. Header
  2. Title 1
  3. Search
  4. Ink import card: "Import your X bookmarks" with an arrow circle
  5. "Try one" header
  6. 3 wave blocks as examples (scholarship butter, GitHub lavender, restaurant peach), each opening Capture prefilled
- **Library:**
  1. Label pill "LIBRARY"
  2. Display "EVERYTHING YOU **SAVED**." (marker on SAVED)
  3. Search with a 1pt ink border (refB)
  4. Chips
  5. Stacked wave blocks, one per type
  6. List rows
- **Item detail:**
  1. Pastel header card: the hero card look at full width, no pill bar, with doodles and status pill
  2. "Do something": 3 action cards
  3. "Facts": fact tile grid
  4. "Results": list rows
- **Result (sheet):**
  1. Pastel band with the label pill "RESULT" and Title 2
  2. Summary in Body
  3. Sections with Headline headers
  4. Checklist rows, 56 tall
  5. Warnings in a butter card
  6. Sticky bottom bar: Copy (secondary) + Share (primary)
- **Capture (sheet):**
  1. Label pill "SAVE"
  2. Display "WHAT DID YOU **FIND**?"
  3. 3 tiles in a row (Link lavender, Text butter, Photo mint): 104 tall, radius 22, 28pt icon, 14/800 label
  4. Input card
  5. "Paste from clipboard"
  6. Example chips
  7. ONE primary Save button pinned at the bottom (disabled = ink at 25%)
- **Activity and Profile:** the same system. Label pill, Display, list rows. On Profile, the stats are 3 pastel tiles with count-ups.

## 10. Voice and microcopy
- Short, active, friendly, sentence case. No exclamation marks except in celebration moments.
- Examples: "Ready to act", "Check eligibility", "Saved to Zapy", "Couldn't read this link. Paste the text instead".

## 11. Visual acceptance checklist
- [ ] No system font anywhere. Archivo Black and Plus Jakarta Sans only.
- [ ] Exactly one "+" in the whole app: the nav button.
- [ ] Every item's pastel matches its type everywhere.
- [ ] No grey text on pastel. All text at least 4.5:1.
- [ ] All touch targets at least 44pt.
- [ ] All animations run on the UI thread (Reanimated) at 60fps, and Reduce Motion is respected.
- [ ] Screenshots of each screen posted next to refA and refB.
