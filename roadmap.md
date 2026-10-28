# Beta-day safety

- [x] Extract the field-attempt policy, update the wait message, and test the helper.
- [x] Report framework, field-plan and offline checks; clearly identify checks unavailable in this sandbox.

# Field app resilience
- [x] Reuse the manifest and existing icons; add preview-safe generated offline worker.
- [x] Adapt the existing install hint to one-time post-entry display.
- [x] Persist recovery metadata and automatically reopen running games on cold app entry.
- [x] Verify tests and preview recovery/install behavior (172 tests; mocked live status, Android/iOS instructions, zero preview workers). Published offline operation and real-device session recovery remain unverified until publication and field testing.