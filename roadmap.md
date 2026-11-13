# Beta-day safety

# No-team pre-match
- [x] Team-less players now see team selection first during the pre-match countdown, with one live "pick your team now" line in both languages; picking a team hands over to the countdown. Verified at 375px against a scheduled start; real matches and phones untested.

# Share card map panel
- [x] Crop the map to the sector/HQ cluster and move sector names into a right-hand legend; test the crop helper (284 tests). Verified bilingual on-screen card and real 1080x1920 exports for landscape and portrait maps; blocked-map fallback kept. Real matches and phones untested.

# Mission audio phase
- [x] Correct only the mission audio bridge; 280 tests passed and active preview shows effects only. Cold-ended preview still shows music/effects instead of the pill; report unchanged listener timing and local-clock risks. Real marshal session, audio hearing and matches untested.

# Personal mission share image
- [x] Build safe-zone map report with matching podium, personal strip, guarded map loading and on-screen preview.
- [x] Test sector/rank helpers (260 total tests); verify bilingual 375px preview and real 1080x1920 PNG export plus blocked-map/scoring-off fallback. Native share sheets, Instagram, phones and real matches untested.

# Debrief totals and labels
- [x] Fetch debrief captures separately without changing the live feed, and test deterministic privacy-aware ranking (254 tests passed).
- [x] Rename player capture labels and the one settings description; both languages fit at 375px. Real >50-capture match and non-preview fetch flow remain untested.

# Respawn and sound beta fixes
- [x] Replace the respawn rescan guard and test its timing boundaries (250 tests passed).
- [x] Update bilingual spawn confirmation, respawn banner and locked scan pill; inspect 375px controls in both languages. Spawn success card reviewed from code only.
- [x] Re-drive music after priming and stop one-shots on effects-off/debrief; browser playback-state checks passed. No audio heard or real phone, second scan or match tested.

# Sound control
- [x] Apply the focused sound-control presentation and visibility changes; verify mobile controls, overlap and unit tests. Cold ended preview remains on lobby; the debrief pill was verified with the existing synthetic match-end signal. Real playback and phones remain untested.

- [x] Extract the field-attempt policy, update the wait message, and test the helper.
- [x] Report framework, field-plan and offline checks; clearly identify checks unavailable in this sandbox.

# Field app resilience
- [x] Reuse the manifest and existing icons; add preview-safe generated offline worker.
- [x] Adapt the existing install hint to one-time post-entry display.
- [x] Persist recovery metadata and automatically reopen running games on cold app entry.
- [x] Verify tests and preview recovery/install behavior (172 tests; mocked live status, Android/iOS instructions, zero preview workers). Published offline operation and real-device session recovery remain unverified until publication and field testing.
