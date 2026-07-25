# TOP_LEVEL_AGENT — settings-spec-baseline-exhaustive

Ticket: `nid_abreq4lmpo8vnvf61y9k9yly0_e` — SettingsSpec 'exact shipped baseline' toEqual silently omits `outlineMaxDepth`.

Branch: `settings-spec-baseline-exhaustive` (off `main`).

## Acceptance criteria (from ticket)
1. `outlineMaxDepth` on both sides of the baseline `toEqual`.
2. Test can no longer silently omit a field — project EVERY key of `SETTINGS_SPEC.globalView`, or add a compile-time exhaustiveness guard, so a new spec entry with no baseline value fails.
- Do NOT weaken existing assertions.
- Do NOT fix the known-RED `linkStrengthFactor.max` baseline (tracked separately).

## Flow (straightforward-flow)
- [x] EXPLORATION (Explore agent) → EXPLORATION_PUBLIC.md
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION (max 4)
- [ ] change_log entry + ticket close + merge to main

## Log
- Created branch, spawned Explore agent.
