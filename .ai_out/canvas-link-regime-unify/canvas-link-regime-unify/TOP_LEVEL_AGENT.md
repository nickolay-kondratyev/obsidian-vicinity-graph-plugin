# TOP_LEVEL_AGENT — canvas-link-regime-unify

Ticket: `nid_s676x55uojmtcwh9t4l9mc6zl_e` — canvas link regime is a per-session coin flip.

## Human decisions (recorded in ticket, non-negotiable)
1. Wikilinks inside canvas TEXT nodes **DO** produce graph edges (as long as perf holds).
2. Fix approach: **option 2 — unify the two regimes** so `core-indexed` and `fallback-required`
   yield the same edge set; the race becomes benign by construction.

## Branch
`canvas-link-regime-unify` off `main`. Merge back with `--no-ff` when done.

## Flow (straightforward-flow)
- [x] EXPLORATION (2 agents: code path + e2e/doc surface)
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION (max 4)
- [ ] change_log entry + ticket closure (TOP_LEVEL only)

## Log
- Created branch + out dir; spawned EXPLORATION and EXPLORATION_E2E.
