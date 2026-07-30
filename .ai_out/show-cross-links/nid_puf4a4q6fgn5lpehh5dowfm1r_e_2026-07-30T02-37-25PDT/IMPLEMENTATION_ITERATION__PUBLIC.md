# IMPLEMENTATION ITERATION — review incorporation ("Show cross links")

Acting on `IMPLEMENTATION_REVIEW__PUBLIC.md` (0 blocking, 2 should-fix, 3 nice-to-have) over
commit `c388a7c`. Not committed — the top-level agent owns git.

**Result: 4 ACCEPTED, 1 PARTIALLY ACCEPTED (variant rejected with rationale).**

## SHOULD-FIX 1 — ON could silently DROP an edge — **ACCEPTED**

The reviewer's diagnosis is correct and the proposed remedy is the right one; I verified it
before applying:

- `truncation.visibleEdges` is exactly the walked pairs whose BOTH endpoints survived the cap
  (`GraphTruncator.ts:51`), so seeding it can never introduce an edge to an invisible node —
  the "node selection unaffected" contract is untouched.
- `EdgeAccumulator` dedupes, so a walked edge that is ALSO induced still emits once, and
  `EdgeCounts` remains the sole multiplicity authority (no second count path).
- The union is now true by CONSTRUCTION rather than by an assumption the pure engine is in no
  position to make about an adapter. I considered no alternative worth the complexity: making
  the sweep read `getIncomingLinks` too would double the provider work and STILL only make the
  two authorities agree by accident.

Changed:
- `src/engine/CrossLinkSweep.ts` — `CrossLinkSweepInput.walkedVisibleEdges` added; the
  accumulator is seeded with it before the sweep. Class doc now states the superset as a fact
  and records WHY (two independent provider authorities + the boot-window degradation).
- `src/engine/VicinityEngine.ts:visibleEdges()` — passes `truncation.visibleEdges` through;
  doc says "the walked set WIDENED to…".
- `docs-internal/plan/high-level-plan.md:128` — the design line now states the union and the
  reason it is constructed rather than derived.

Started from FAILING tests (both red before the fix, log `.tmp/red.log`):
- `src/engine/CrossLinkSweep.test.ts` — "WHEN a walked edge is invisible to the outgoing
  channel THEN the sweep still emits it" (+ a companion pinning that a walked edge which is
  also induced emits once).
- `src/engine/VicinityEngine.test.ts` — new describe *"cross links never drop a walked edge"*:
  an `OutgoingBlindProvider` decorator whose outgoing channel has gone blind for `linker.md`
  while backlinks still report it, built with `linkDepthIn: 1`. Red output was exactly the
  dropped `linker.md->hub.md`. Its OFF twin pins the baseline, so the pair cannot both go
  green by the edge disappearing everywhere.

## SHOULD-FIX 2 — missing ON coverage / vacuous node-set test — **ACCEPTED**

In `src/engine/VicinityEngine.test.ts`, `describe("with cross links ON")`:
- **incoming channel** — covered by the new divergent-provider describe above
  (`linkDepthIn: 1`, ON, backlink-discovered edge survives).
- **node cap** — the old "node set identical to OFF" test used a cap that never bound (3 nodes,
  default cap), so both sides were trivially the whole vault. Replaced with a cap of 1 over 2
  non-centrals and asserted against a LITERAL node set, so it fails if the cap stops binding,
  if ON diverges from OFF, or if either side's truncation changes.
- **exclusion** — ON + `^b\.md` ⇒ edges are exactly `["hub.md->a.md"]` (an equality, not a
  `not.toContain`, so a sweep that re-admitted the excluded note anywhere fails).
- Helper fix enabling this: `crossLinkBuild()` now merges caller `globalView` overrides and
  forces `showCrossLinks: true` LAST — previously an override would have silently turned the
  toggle back off, which would have made every one of these cases vacuous.

## NICE-TO-HAVE 3 — vacuous determinism test — **PARTIALLY ACCEPTED (deleted; the suggested replacement REJECTED)**

Accepted that the test could not fail (it sorted both sides) — **deleted**.

**Rejected** the offered replacement (assert the UNSORTED output order follows `visiblePaths`
insertion order). Edge ORDER is not load-bearing anywhere: the only consumer,
`GraphStructureDiff`, compares edge ids as a `Set` (`GraphStructureDiff.ts:63`). Asserting an
order nothing depends on over-specifies the sweep and would turn a free implementation choice
into a test to maintain. Real determinism is already pinned end-to-end by
`VicinityEngine.test.ts` "WHEN the same request is built twice THEN outputs are identical".
Net test count still rises (+5, −1).

## NICE-TO-HAVE 4 — kind-blindness vs `embedDepthOut` — **ACCEPTED**

One WHY paragraph in `CrossLinkSweep`'s doc: the sweep is kind-blind on purpose, so with
`embedDepthOut: 0` an embed between two visible notes IS drawn when the toggle is on; that
matches the setting's wording and the equally kind-blind `getLinkCount` behind the badge —
depth dials govern REACH, this toggle governs what is drawn between what reach found.

## NICE-TO-HAVE 5 — cost note — **ACCEPTED**

One paragraph in the same doc: cost is bounded by the NODE CAP, not vault size (≤1
`getOutgoingReferences` per visible node per rebuild), with the "re-check if the cap grows an
order of magnitude" caveat. Cheap, and it keeps a future cap increase honest.

## Not re-litigated (per instruction)

Global-only settings (no cascade) and the new "Edges" section — both left exactly as shipped.

## Test results (run by me, logs in `.tmp/`)

| Command | Result |
|---|---|
| `npx vitest run` (the 2 touched suites, BEFORE the fix) | **2 failed / 38 passed** — both new tripwires red for the right reason (`.tmp/red.log`) |
| `npm test` | **PASS — 97 files, 1308 tests, 0 failures** (`.tmp/test.log`) |
| `npm run check` | **PASS — exit 0**, `tsc -noEmit` clean for `src/` and `e2e/` (`.tmp/check.log`) |

1304 → 1308 tests: +5 added, −1 vacuous removed. No behavior-capturing test weakened, no
`ap_XXX_E` anchor touched. `npm run test:e2e` not run (real-Obsidian release gate, unchanged
scope — still no e2e spec for this toggle, as recorded in PRIVATE.md).

## Readiness

**READY.** Both should-fix items are closed with tests that were demonstrated red first; the
three nice-to-haves are resolved (two doc paragraphs, one deletion) with the one over-specifying
variant rejected above. Nothing else in `c388a7c` was touched.
