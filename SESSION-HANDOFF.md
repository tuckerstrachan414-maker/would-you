# SESSION-HANDOFF

## 2026-07-10 — initial build (Claude Fable 5)

**What exists:** the full app, built to plan (plan file:
`~/.claude/plans/i-want-to-make-witty-bumblebee.md`). 405 questions (target
was ~450 — trivially extendable, append rows). All screens: play, history,
favs, stats, more. Never-repeat picker with least-recently-seen recycling,
category filter, streak, favourites, hot-take reveal, offline vote queue,
share via Web Share API with ?q= deep link, PWA manifest + service worker,
scribble theme with bundled Patrick Hand.

**Browser-verified (observed working over http://localhost:8123):**
- _selftest.html — 20/20 PASS: boot render, bank=405, answer/history/seen,
  reveal + no-signal note, 41 unique draws, favourite, history timestamps,
  stats tiles, pondered counter, 7 category chips, filter persisted and
  respected over 20 draws, ?q= deep link forces question, vote queues offline.
- _layouttest.html — 12/12 PASS at 390px iframe: no horizontal overflow, font
  loaded, card + tabs fit, tap targets ≥44px (measured 67–98px), reveal fits,
  .bar-a has 0.9s width transition.
- Desktop-width screenshot confirmed the scribble look renders (wobbly card,
  category tag, tinted A/B buttons, bottom tabs).

**NOT yet verified — needs a human or deploy:**
- Real aesthetic pass on a phone (geometry verified, taste is not).
- Live Firestore votes (backend not created yet — Tucker's 5-min step,
  see BACKEND-SETUP.md, then set STATS_BACKEND in app.js).
- Web Share sheet on a real phone; clipboard fallback.
- PWA install prompt (manifest icons are data-URI SVG — may need real PNGs).
- Cold ?q= link from a second device (needs public URL).
- file:// smoke test (copy folder, double-click index.html) — should work by
  construction (sw guarded, backend optional) but not observed yet.

**Gotcha that cost time:** the service worker is cache-first with runtime
caching + ignoreSearch, so edited files were served stale until CACHE_V was
bumped (now at bigif-v3). Underscore-prefixed files are now exempt. Bump
CACHE_V on every shipped change — it's in CLAUDE.md as an invariant.

**Next steps:** (1) Tucker: Firebase project per BACKEND-SETUP.md; (2) with
Tucker's ok, deploy to GitHub Pages via gh, set the real APP_URL in app.js;
(3) two-profile vote test + cold ?q= test; (4) delete _selftest.html,
_layouttest.html, _testresult.txt before/at deploy (harmless if left — SW
skips them, but they're clutter).

**Dev harness:** serve.js lives in the session scratchpad (recreate freely:
node static server on 8123 rooted at big-if/, plus POST /log that writes the
request body to big-if/_testresult.txt). Test pages POST their PASS/FAIL log
there. Load test pages twice after an SW change (first load updates the SW).

## 2026-07-10 (later) — live backend wired up (Claude Fable 5)
Firebase project **big-if-tucker** created entirely from the CLI (Tucker did
one interactive `firebase login` in a spawned terminal). Firestore DB (nam5),
security rules deployed, web app registered, config pasted into app.js.
Browser-verified via _votetest.html — 8/8 PASS: fetchCounts reachable, a/b
votes increment through the app's real sendVote, rules reject a bogus field
and leave no trace. Test doc votes/zzz-selftest deleted with the CLI's admin
token. CACHE_V now bigif-v4 (stale app.js bit again — bump on every change!).
Remaining: deploy to GitHub Pages (needs Tucker's ok), set real APP_URL,
two-device vote + cold ?q= test, delete _*.html test files at deploy.

## 2026-07-10 (evening) — DEPLOYED (Claude Fable 5)
Live at **https://tuckerstrachan414-maker.github.io/would-you/** (repo
tuckerstrachan414-maker/would-you, GitHub Pages from main root). gh CLI is a
portable zip in the session scratchpad (winget MSI failed with 1601); if a
future session needs gh, re-download the windows_amd64 zip from cli/cli
releases. Dev/test files (_*.html, _testresult.txt, start-server.bat) are
gitignored — local only. start-server.bat calls python (not installed) — broken,
not mine, left as-is.

**Observed working on the deployed site:** all shell files serve 200 at correct
sizes; deployed app.js has the live STATS_BACKEND; cold ?q=wyr-002 deep link
opened in a browser, Tucker voted, and the Firestore count incremented
(createTime 2026-07-10T22:55Z). That verifies share links + global stats
end to end.

**Still unverified (needs Tucker's phone):** Web Share sheet, real-device look,
PWA install prompt (data-URI manifest icons may need real PNGs). App is still
titled BIG IF; Tucker named the repo "Would You?" — rename offer is open
(one constant + manifest + index.html title).
