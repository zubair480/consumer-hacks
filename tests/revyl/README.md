# Phase 1 Revyl tests

Fifteen end-to-end checks for the Phase 1 gate, one YAML file per test. Each file lists the steps, the expected result, and the testIDs it touches. Fixtures live in `fixtures/fixtures.json`.

Run them on one Revyl cloud iPhone 16 against a Release simulator build (JS bundled, `EXPO_PUBLIC_CONVEX_URL` from `.env`):

1. `npm ci && npx expo prebuild --platform ios`, `pod install`, then `xcodebuild -configuration Release -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO`.
2. Install the .app on the phone and run tests 01 to 15 in order; 06 and 13 relaunch the app and rely on data created by the earlier tests.
3. Take a screenshot per step. Results and screenshots for each run go in `reports/`.
