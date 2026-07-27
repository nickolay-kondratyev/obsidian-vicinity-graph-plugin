# TOP_LEVEL_AGENT — settings-debounce-validation

Ticket: `nid_x6l6x07rd1d1h4cefqmnyrbec_e` — "Settings tab: debounce numeric/text writes and validate bounds"

Branch: `settings-debounce-validation` (off `main`). Flow: straightforward-flow
(IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION).

## Acceptance criteria (from ticket)
- Numeric/text settings debounce before persisting + rebuilding.
- `maxPx < minPx` rejected with visible feedback rather than silently persisted.
- Upper bounds defined in SETTINGS_SPEC for sizing px and decay-k.
- Invalid regex lines surfaced to the user.
- BDD tests cover each.

## Progress
- [x] Branch created.
- [ ] EXPLORATION (2 agents: CODE + TESTS)
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] change_log entry + ticket close + merge to main
