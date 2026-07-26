# TOP_LEVEL_AGENT — e2e-breadcrumb-red-gate

Ticket: `nid_yccejkvl0ccqc77olsgg5deka_e` — e2e release gate RED:
`e2e/vicinityGraph.e2e.ts:160` breadcrumb never appears for `solo/gamma.md`.

Branch: `e2e-breadcrumb-red-gate` (off `main`).

## Acceptance
`npm run test:e2e` exits 0, all specs run, breadcrumb behaviour either fixed in `src/`
or the test corrected with written rationale.

## Flow (straightforward-flow)
1. EXPLORATION (2 parallel Explore agents) — breadcrumb render path + e2e harness/fixture.
2. IMPLEMENTATION_WITH_SELF_PLAN
3. IMPLEMENTATION_REVIEW
4. IMPLEMENTATION_ITERATION (max 4)

## Log
- [x] Exploration (2 parallel Explore agents) → committed `f45082d`.
      Both concluded: breadcrumb unimplemented in `src/`; sibling `:85` test passes vacuously.
- [x] IMPLEMENTATION_WITH_SELF_PLAN → commits `60b6383`, `c2ea883`.
      **Reversed the exploration hand-off**: found `998fdac` (2026-07-23,
      "snug capped node width + remove folder prefix") deliberately removed the breadcrumb
      end-to-end. Declared the e2e test stale; retired the expectations; **no `src/` behaviour
      change**. Claims gate green: `test:e2e` exit 0, 78 passed, 0 did-not-run.
- [x] IMPLEMENTATION_REVIEW — upheld the stale-test call with *stronger* evidence
      (`998fdac` deleted the breadcrumb sentence from `high-level-plan.md:59` — an affirmative
      decision, not mere silence). Re-ran all four gates: reproduced exactly, zero discrepancies.
      **1 BLOCKING**: the replacement guard was still vacuous and its JSDoc falsely claimed
      "vault-wide".
- [x] IMPLEMENTATION_ITERATION (1 of max 4) → `712a73c`. B1 fixed; non-vacuity proven
      empirically by re-threading the removed breadcrumb (guard went RED, old placement stayed
      green) then reverting — `src/` byte-identical. 5 items accepted, 1 rejected with reason.
- [x] IMPLEMENTATION_REVIEW (verification pass) — 0 BLOCKING, 0 SHOULD-FIX, gates re-run and
      reproduced. **Both roles signal readiness → converged in 1 iteration.**
- [x] TOP_LEVEL: change_log `883m2pjjyscv9m3a5a51kvd6d`; ticket
      `nid_yccejkvl0ccqc77olsgg5deka_e` closed with resolution; merge to `main`.

## Outcome
Root cause was a **stale test**, not a missing feature: `998fdac` deliberately removed the
folder breadcrumb end-to-end and left the e2e assertions behind. No `src/` behaviour change.
Gate: `test:e2e` exit 0 — 78 passed, 1 env-gated skip, **0 "did not run"**.

## Open items for the human
1. `[decide]` `nid_rdx8ea6w1km9eywyvhpx1v7rt_e` — ungrouped non-root notes now show no folder
   identity at all. Reviving it is a product/UX call; ticket carries 4 ranked options.
2. `nid_c5acy7gm7lj3afz0vtq79k8bx_e` — systemic: `npm test` excludes e2e, so a feature removal
   like `998fdac` cannot go red in the fast loop. (Reviewer note: exempt `toHaveCount(0)`
   assertions from the proposed tripwire, or it false-positives on the new absence guard.)
3. Two ticket systems coexist — `_tickets/` via the `ticket` CLI vs `docs-internal/tickets/`
   per `CLAUDE.md`. Filed via CLI + cross-referenced as an interim; which is authoritative
   needs a human ruling.
