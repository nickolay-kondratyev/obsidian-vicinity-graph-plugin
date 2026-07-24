# IMPLEMENTATION — Ticket 03 force placement quality (PASS 2 — CONVERGED)

## STATUS: DONE. RE_PLAN executed in full; unit + typecheck green; e2e triaged (both failures pre-existing on main, verified by stash-baseline runs); visual acceptance PASSED on the dev-vault repro.

Pass-1 history (the escalation that empirically invalidated the ORIGINAL plan and led
to `RE_PLAN__PUBLIC.md`) is preserved in git history of this file — commits
`b25e31c`/`0249955`. This file now documents pass 2 only.

## What shipped (uncommitted working tree; top-level agent commits)

| File | Change |
|---|---|
| `src/view/forceRectCollide.ts` (new) | Deterministic pairwise AABB collision force for d3-force: anticipated positions (`x+vx`), padded half-extents, minimum-penetration axis, symmetric half/half velocity split, fixed pair order, positive tie-break for coincident centres (zero randomness). O(n²) per pass with WHY comment (root children only, ~300 static ticks). |
| `src/view/forceRectCollide.test.ts` (new) | 7 BDD unit tests driving the force directly: min-axis selection both axes, padding-as-separation, no-op when separated, deterministic tie-break, anticipated-position handling, multi-iteration idempotence. |
| `src/view/d3ForceRefinement.ts` | `forceCollide` (circumscribed radius) → `forceRectCollide(D3_FORCE_COLLIDE_PADDING_PX, D3_FORCE_COLLIDE_ITERATIONS)`; dropped `collideRadius` from `ForceBody`; link resting distance → `minHalfExtent(s)+minHalfExtent(t)+D3_FORCE_LINK_GAP_PX`; module doc + WHY comments cite prototype numbers (207→33). |
| `src/view/constants.ts` | WHY comments for `D3_FORCE_LINK_GAP_PX` / `COLLIDE_PADDING_PX` / `COLLIDE_ITERATIONS` rewritten for the rect-collide rationale (padding 20 / 2 iterations kept — prototype showed 2×/3-pass measurably worse). Values unchanged. |
| `src/view/d3ForceStranding.test.ts` (new) | Ticket-03 regression: `strandedHubGraph(5)` Enchiridion mirror through the REAL elk-seed → d3 pipeline; asserts every projected root edge's boundary gap ≤ `D3_FORCE_MAX_BOUNDARY_GAP_PX` (100, WHY-documented) + zero root-box overlaps. |
| `scripts/setup-dev-vault.sh` | Ticket-03 repro cluster: `stranded-main.md`, `p/ep/{stranded-hub,stranded-sib}.md`, `p/ep/book/enchiridion.md`, 5 crowd notes; smoke-check text updated. Self-contained (no links from existing fixtures). |
| `docs-internal/CHANGELOG.md` | New top entry "force layout: rectangular collision fixes container stranding (ticket 03)". |
| `docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md` (new) | Follow-up ticket for a pre-existing e2e failure found during triage (below). |

Steps 1–3 were implemented by the pass-2 predecessor (died mid-run on API error);
audited line-by-line this session against RE_PLAN + prototype — no fixes needed.

## RED → GREEN evidence (honest provenance)

- **RED** (real, not reconstructed): `.tmp/impl-red.log`, mtime 2026-07-24 03:24 —
  the committed `d3ForceStranding.test.ts` run against BASELINE defaults failed with
  `expected 206.5235742967829 to be less than or equal to 100` (plan predicted ~207).
  This log was produced by the predecessor before the refinement rewiring landed.
- **GREEN**: full `npm test` = **703/703 pass** (`.tmp/impl2-test-final.log`);
  `npm run check` exit 0. Measured worst boundary gap after fix = **32.84px**
  (`.tmp/impl2-green-measure.log`; obtained by temporarily asserting `≤ -99999` to
  force-print the value — vitest here is silent-config; test restored byte-identical).
  Matches the prototype's 33.

## E2E triage (release gate) — verdict per failure

Full run (`.tmp/impl2-e2e.log`): **21 passed, 2 failed, 7 did-not-run** (serial abort).

1. `edgeRoutingEval.e2e.ts:171` "radial layout SKIPS routing (gated)" — routing ran
   (132ms) where the test expects none. **PRE-EXISTING**: reproduced identically on
   stashed-baseline code (`.tmp/impl2-e2e-baseline.log`). Already tracked:
   `_tickets/e2e-remove-layeredradial-layout-mode-references-left-by-force-layout-only-ticket.md`
   (leftover radial references after ticket-01/02 removed the mode/gating).
2. `vicinityGraph.e2e.ts:160` gamma singleton-folder breadcrumb not found —
   **PRE-EXISTING**: reproduced on stashed-baseline code with identical vault AND
   again with the ticket-03 fixture notes deleted
   (`.tmp/impl2-e2e-baseline-nofixture.log`); consistent 4/4 runs, not flake. NEW
   follow-up ticket filed: `docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md`.

The 7 "did not run" were then executed against my change with the two pre-existing
failures grep-inverted: **all 24 pass** (`.tmp/impl2-e2e-rest.log`) — including the
PERF BUDGET test and the two historically-flaky node-click tests. Net: **no e2e test
is broken by this change; the gate's 2 reds exist on main without it.**

## Visual acceptance (step 6)

- Real Obsidian (headless Electron via the e2e harness), dev-vault repro note
  `p/ep/stranded-hub.md`, via a TEMPORARY spec (deleted after run — not committed):
  screenshot `.out/ticket-03-stranded-hub-after-fix.png`. **PASS** — `enchiridion`
  sits directly adjacent to the `ep` group box, crowd notes ring the group closely,
  no stranded mid-graph leaf / long crossing edge.
- `.out/vaults/public` `we-have-a-finite-amount-of-time.md` cross-check: **NOT done**
  — the e2e harness is hard-wired to launch on a copy of `.dev-vault`
  (`obsidianHarness.ts`), and pointing real Obsidian at the public vault is a harness
  change out of scope. Explicitly relying on the metric test + dev-vault mirror
  instead; the human smoke run can cover the public vault
  (`docs-internal/tickets/ticket-step-03-human-smoke-run.md` flow).

## Caveats

- Known geometric limit (documented in RE_PLAN): at crowd ≥ 10 second-ring overflow
  means the *worst* gap can exceed the old uniformly-bad baseline; the committed
  assertion deliberately targets the crowd=5 vault mirror.
- Nothing committed per instructions; working tree holds all changes listed above.

No `#QUESTION_FOR_HUMAN` items.
