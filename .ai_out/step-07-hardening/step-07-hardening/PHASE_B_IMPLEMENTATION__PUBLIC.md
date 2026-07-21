# PHASE B (Performance pass) — Reviewer handoff

Role: IMPLEMENTATION_WITH_SELF_PLAN. All gates green. NOT committed (working tree left dirty for review). Phase A handoff archived at `PHASE_A_IMPLEMENTATION__PUBLIC.md`.

## Gates
- `npm run check` → EXIT 0 (`.tmp/phaseB-check.log`)
- `npm test` → 559 passed (main) + 69 (sublib), 0 fail (`.tmp/phaseB-test.log`)
- `npm run build` → EXIT 0; `styles.css` regenerated from `src/view/graph-view.css` (`.tmp/phaseB-build.log`)
- **11 new tests**, 0 skips, 0 hacks. Production logic unchanged except the CSS fix and one React Flow prop.

## Files changed (source)
| File | Item | Change |
|---|---|---|
| `src/view/graph-view.css` | B1 | Pin-button: `pointer-events:none` while hidden + `display:none` below the 72px container-query threshold; re-enabled (`opacity`/`pointer-events:auto`) on hover/focus. |
| `src/view/NeighborhoodGraphFlow.tsx` | B2 | Added `onlyRenderVisibleElements` prop to `<ReactFlow>` (viewport culling). |
| `src/view/flowMapping.test.ts` | B2 | +3 tests: thumbnail-key stability (no-refetch-storm contract). |
| `src/view/GraphViewController.test.ts` | B3, B4 | +6 tests: 1 skip-rate invariant, 5 metadata-resolve debounce (fake timers). Updated the stale "out of scope" header comment. |
| `src/persistence/OrphanSweeper.test.ts` | B5 | +2 tests: 500-file scale (yield count + all-live no-op). |

`styles.css` / `main.js` are gitignored build outputs (regenerated) — not part of the review diff; the SOURCE change is `graph-view.css`.

## Per-item status

### B1 — Hover-pin CSS fix — **FIXED**
- Root cause (ticket `_tickets/hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click.md`): `opacity:0` pin button still receives pointer events and, on nodes < ~48px, blankets the body → clicks hit the button (`stopPropagation`) instead of opening the note.
- CSS-only fix in the SOURCE `graph-view.css`: (1) `pointer-events:none` by default, `:auto` only when revealed on hover/focus — the transparent button no longer eats the open-click at ANY size; (2) `display:none` below `@container (min-height:72px)` (same threshold as the attachment strip) so tiny nodes carry no pin affordance. Right-click pin/unpin (`NoteNode.onContextMenu`) untouched; keyboard focus still reveals the button (focus is independent of pointer-events/opacity).
- Verified `npm run build` regenerates `styles.css` with the change (grep-confirmed). CSS → no pure test applicable.
- e2e note: interaction e2e currently clicks the ALPHA (3 large) graph to dodge this bug. With B1, small-node click-to-open should work again → that workaround can likely be reverted. **Did NOT run full e2e** (needs the Obsidian binary); flagged for TOP_LEVEL.

### B2 — Image lazy-load + viewport culling — **FIXED**
- Applied `onlyRenderVisibleElements`. Verified the React Flow v12 subflow behaviour directly in `node_modules/@xyflow`: visibility is per-node off `internals.positionAbsolute` (children computed correctly), and `forceInitialRender = !handleBounds` keeps folder-group parents (they render no `<Handle>`) ALWAYS mounted — the container never disappears out from under its children. **No concrete break reason found → applied, not ticketed.**
- "No refetch storm on rebuild": guarded at the pure/mapping level (no React harness stood up, per instructions). `flowMapping` emits `firstImagePath` as a stable PRIMITIVE string, identical across independent rebuilds — the exact `useMemo` key `NoteNode.thumbnailUrl` depends on. A refactor to an object reference would break the memo AND fail these tests.
- Residual: could not browser-verify the culling prop here (no component-test infra; e2e needs Obsidian). Code analysis supports it; recommend a one-time visual/e2e smoke. Verification follow-up, **not a ticket** (no known defect).

### B3 — Rebuild debounce — **FIXED** (was the top untested gap)
- Closed the explicitly-skipped gap. New `metadata-resolve debounce` block: `vi.useFakeTimers({ toFake: ["setTimeout","clearTimeout"] })` + `vi.stubGlobal("window", globalThis)` — deterministic, no real 500ms wait; `flush()`'s `setImmediate` left real so the async pipeline still drains. No jsdom switch, no global leak (`afterEach` restores).
- Covers: burst within window → 0 rebuilds yet (coalesced); window elapses → exactly ONE rebuild (not five); active-file change → immediate; active-file AND settings change each CANCEL a pending debounce (the immediate-vs-debounced distinction).

### B4 — Structural-diff elk-skip — **VERIFIED + STRENGTHENED**
- Existing single-reuse test proved skip once. Added `structural-diff skip rate`: after the first layout, 5 same-structure rebuilds keep `layout.callCount === 1` (0 elk across repeats = 100% skip). Asserted via the existing `FakeLayout.callCount` — **no metrics counter added** to the controller (Pareto: the invariant is the signal; a counter would be over-engineering).

### B5 — Orphan sweep scale-up — **FIXED**
- New `hundreds-of-files scale` block at 500 files. Asserts `yieldCount >= 24` STRUCTURALLY (500 / batch-20 → warm-phase boundaries at 20..480 = 24 yields; derived constant `MIN_WARM_PHASE_YIELDS`; later phases only add more) — no wall-clock (per CLARIFICATION). Second test: all-live → sweep removes nothing (correctness holds at scale).

## Tickets created
- **NONE.** Every perf finding was cheap enough to fix in place. Exit criterion ("no perf item left unfixed without a ticket") met with zero tickets because zero items were deferred.

## Open questions for TOP_LEVEL (non-blocking)
- Optional follow-up (needs Obsidian binary, out of pure-test scope): revert the e2e sparse-graph workaround now B1 is fixed, and visually smoke `onlyRenderVisibleElements` for folder-group rendering.

No `#QUESTION_FOR_HUMAN`. No hacks, no skipped/faked assertions.
