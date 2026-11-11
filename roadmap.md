# Beta-day safety

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