# TOP_LEVEL_AGENT — e2e-pinned-centrals-absent

Ticket: nid_d9j4o9ecp93g5zhury5m1fb43_e — no spec asserts the "Pinned centrals" disclosure is
ABSENT when nothing is pinned.

Branch: `e2e-pinned-centrals-absent` (off `main` @ 45967a9).

## Flow (straightforward)

1. [x] EXPLORATION → EXPLORATION_PUBLIC.md
2. [ ] IMPLEMENTATION_WITH_SELF_PLAN
3. [ ] IMPLEMENTATION_REVIEW
4. [ ] IMPLEMENTATION_ITERATION (max 4)
5. [ ] change_log entry + ticket close + merge --no-ff to main

## Acceptance

A spec asserts that with NO pinned centrals, no
`.vicinity-graph-toolbar__body > .vicinity-graph-disclosure` summary matches
`/^Pinned centrals \(\d+\)$/`. Making the disclosure render unconditionally in
`src/view/GraphToolbar.tsx` must fail that spec (mutation-verified).

## Log

- Created branch, spawned Explore agent.
