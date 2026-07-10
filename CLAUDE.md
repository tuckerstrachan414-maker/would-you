# BIG IF — project conventions

Phone-first hypotheticals / would-you-rather / press-the-button web app.
No build step, vanilla JS, opens from file:// (live stats degrade gracefully).

## Invariants — do not break
- **Question IDs are STABLE FOREVER.** Global stats and user history key off
  them. Never renumber, never reuse a deleted id. Retire a question by deleting
  its row; its id stays burned.
- **Add a question = append one row** to `QUESTIONS` in questions.js. Three row
  shapes: `type: "wyr"` (a/b), `type: "button"` (text + catch), `type: "hypo"`
  (text only, no vote). questions.js has an IIFE that console-errors on
  duplicate ids — check the console after bulk edits.
- **No build step, no CDN, no external requests except Firestore.** Font is
  bundled in fonts/. The app must keep working when copied as a folder and
  opened via file://.
- **No emoji in UI chrome.** All interface icons come from the ICON registry
  in icons.js ("add an icon = one entry", inline scribble SVGs). Emoji are
  allowed only inside question text and the share-message string. The
  selftest scans every screen for stray emoji.
- **Typed hypo answers ("takes") are moderated.** Clients can only create
  takes/{id} docs with approved:false, text <= 60 chars, name <= 20; only
  approved ones are readable. Tucker approves via approve.bat (needs a
  machine with `firebase login` done) or the Firebase console. Never relax
  the takes rules.
- **Bump `CACHE_V` in sw.js on EVERY shipped change.** The service worker is
  cache-first and runtime-caches all same-origin GETs with ignoreSearch —
  clients never see updates until the version bumps. (Files starting with `_`
  are exempt: dev/test scratch, never cached.)

## Layout
- questions.js — the bank (405 questions: wyr-001..220, btn-001..125,
  hyp-001..060; cats: silly/gross/food/money/powers/deep/spicy)
- icons.js — ICON scribble-SVG registry + icon()/catTag() helpers
- approve.js / approve.bat — Tucker's take-moderation CLI (admin creds via
  firebase-tools login; safe to commit, contains no secrets)
- app.js — all logic. MODES registry drives the play-mode picker
  ("add a mode = append one row"). sendTake/fetchTakes talk to the takes
  collection. `STATS_BACKEND` at top: null until Firebase config pasted
  (see BACKEND-SETUP.md). `APP_URL` derives from location; placeholder until
  deployed. localStorage key "bigif-v1".
- styles.css — scribble theme (wobble borders, marker bars, Patrick Hand)
- sw.js — cache-first shell; skips POSTs, firestore hosts, `_*` files
- _selftest.html / _layouttest.html / _testresult.txt — dev-only test harness
  (needs the scratchpad serve.js /log endpoint). Delete or ignore for deploy;
  the SW never caches them.

## Deliberately later (don't build unprompted)
Achievements, submit-your-own questions, friend-vs-friend compare, sound
effects, dark mode. Manifest icons are data-URI SVG — may not satisfy every
PWA installer; swap for real PNGs if install prompts don't appear.

## Verification convention
Locate code by grepping tokens (e.g. `function renderReveal(`), never line
numbers. Standard is "observed working": run the selftest pages over
http://localhost:8123 (node static server with a POST /log endpoint that
writes _testresult.txt) and read the PASS/FAIL lines from disk.
