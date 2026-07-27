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
- [x] IMPLEMENTATION_WITH_SELF_PLAN (621ece9, 42076cb, a46e826)
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION (max 4)
- [ ] change_log entry + ticket closure (TOP_LEVEL only)

## Log
- Created branch + out dir; spawned EXPLORATION and EXPLORATION_E2E.
- EXPLORATION_E2E agent had no write tools; TOP_LEVEL persisted its findings to
  `EXPLORATION_E2E_PUBLIC.md`. Committed as `bdf2cdf`.
- IMPLEMENTATION reports: 5/5 e2e runs at 11 edges; 4 probe runs hit BOTH regimes yet still 11
  (race benign by construction). `npm test` 1075 pass, `check` clean. Two residual regime gaps
  deferred to new ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e` (markdown-style links + `[[..]]` in code
  spans). Claims edge ORDER still differs between regimes and cannot be unified.
- Spawned IMPLEMENTATION_REVIEWER; flagged the ordering claim as the key thing to verify (if order
  feeds truncation/top-N, the race stays user-visible and the fix is incomplete).
