# IMPLEMENTATION_REVIEW__PUBLIC — PHASE B (Performance pass)

(Phase A public review archived at `PHASE_A_REVIEW__PUBLIC.md`.)

## VERDICT: APPROVE-WITH-NITS  (0 blocking)

Gates re-run by reviewer: `npm run check` EXIT 0 · `npm test` 559 passed (main) + 69 (sublib), 0 fail.
Product code touched: `src/view/graph-view.css` (B1), `src/view/NeighborhoodGraphFlow.tsx` (B2). Rest is test-only.
All five items (B1–B5) are genuinely addressed; new tests are non-vacuous. No hacks, no silent skips, no
race-masking sleeps. One follow-up should be tracked as a ticket rather than a loose note (see [SHOULD] below).

## Findings

| # | Tag | Item | File:line | Rationale |
|---|-----|------|-----------|-----------|
| 1 | [SHOULD] | B2 | `src/view/NeighborhoodGraphFlow.tsx:107` | `onlyRenderVisibleElements` is the only behavioral product change and has NO automated regression net. Its subflow-safety rests on a React Flow v12 INTERNAL (`forceInitialRender = !handleBounds`) — not a public contract, fragile across RF upgrades. Precondition verified (FolderGroupNode renders no `<Handle>`; NoteNode does), and no defect found, but runtime culling + folder-group parent/child positioning + edge culling is untested (can't be unit-tested here — no `.test.tsx` infra, out of scope). Implementer filed the visual/e2e smoke as a loose "open question for TOP_LEVEL". Recommend a real ticket so it (and the RF-upgrade fragility) isn't lost. Not blocking: transparently disclosed, plausibly investigated. |
| 2 | [NIT] | B2 | `src/view/flowMapping.test.ts` (thumbnail-key block) | The describe name "no-refetch-storm contract" over-claims: the 3 tests pin a NECESSARY precondition (firstImagePath is a stable primitive useMemo key) — real value is test1 (`typeof === "string"`) + test3 (`undefined` when no image), a genuine discriminator. Test2 ("string-equal across independent mappings") is near-tautological for a passed-through primitive. Harmless, intent-documenting. The actual no-refetch behavior lives in `NoteNode`'s useMemo + browser and stays untested by design (no component-test infra). |
| 3 | [NIT] | cross | handoff "0 tickets" | Defensible (every item fixed, no measured defect). Overlaps #1 — the B2 visual-smoke follow-up would be better as a tracked ticket per ownership. |

## What was verified as REAL (not just green)
- **B1** — SOURCE `graph-view.css` fix. Idle: `display:none`+`opacity:0`+`pointer-events:none`; `@container
  (min-height:72px)`→`inline-flex`; hover/focus→`opacity:1`+`pointer-events:auto`. Container context confirmed
  (`.neighborhood-graph-node { container-type: size }`). Resolves the ticket (opacity:0 button no longer eats
  the open-click at any size) without breaking right-click pin/unpin (node-level `onContextMenu`, reachable
  even where the button is `display:none`). Both guards are exactly CLARIFICATION Q4's "FIX NOW" spec.
- **B3** — debounce coalescing is genuine: `FakeGraphSource.build()` records synchronously, so `calls`
  proves burst→0 rebuilds pending and window-elapse→exactly 1. Immediate-cancels-pending proven for BOTH
  active-file and settings changes with a 2×-window post-advance. Fake timers scoped to setTimeout/clearTimeout,
  `window` shim + timers restored in `afterEach` — no global leak. Prior "out of scope" was prose, not a `.skip`.
- **B4** — 5 same-structure rebuilds keep `layout.callCount === 1`; would be 6 if elk-skip were removed.
- **B5** — 500-file sweep asserts `yieldCount >= 24` = `floor((500-1)/20)`, matching ChunkedWork's boundary
  rule; collapses to 0 (fail) if chunking were removed. All-live summary asserts zero removals.

## Questions for human
- None. (`#QUESTION_FOR_HUMAN`: none.)
