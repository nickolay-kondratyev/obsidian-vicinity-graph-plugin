# IMPLEMENTATION_REVIEWER — PHASE B (Performance pass) — PRIVATE notes

Reviewed: uncommitted working-tree changes vs HEAD. Gates re-run by me: `npm run check` EXIT 0;
`npm test` 559 passed (main) + 69 (sublib), 0 fail. Matches implementer's handoff.

Product-code files changed: `src/view/graph-view.css`, `src/view/NeighborhoodGraphFlow.tsx`.
Test-only: `flowMapping.test.ts` (+3), `GraphViewController.test.ts` (+6), `OrphanSweeper.test.ts` (+2).

## B1 — hover-pin CSS fix (graph-view.css) — SOUND
- Fix is in the SOURCE `src/view/graph-view.css` (not just generated styles.css). Confirmed.
- Idle base: `display:none`, `opacity:0`, `pointer-events:none`.
- `@container (min-height:72px)` flips `display:inline-flex` (still opacity:0 + pointer-events:none idle).
- Node `:hover` / button `:focus-visible` → `opacity:1` + `pointer-events:auto`.
- Container context verified: `.neighborhood-graph-node` has `container-type: size` (graph-view.css:80) and
  the pin button is its absolute-positioned descendant → the 72px query resolves against the node's own
  height. Same threshold already used by the attachment strip → consistent.
- Bug resolution reasoning: the ticket bug is that an opacity:0 button STILL receives pointer events and, on
  a shrunk node, blankets the body so the open-click hits the button (stopPropagation) instead of the note.
  `pointer-events:none` while hidden removes that at ANY size. When revealed on hover it becomes a 20×20
  corner chip covering only its own rect — body clicks still open the note; chip clicks pin. Right-click
  pin/unpin lives on NoteNode.onContextMenu (node-level), untouched by the button's display/pointer-events →
  reachable even on <72px nodes where the button is `display:none`. Verified FolderGroupNode/NoteNode split.
- Both guards (pointer-events + size-threshold hide) are exactly what CLARIFICATION Q4 "FIX NOW" specifies —
  not scope creep. Part 2 is redundant for the click-bug (part 1 already fixes it) but is a deliberate UX
  choice (no pin affordance on tiny nodes), human-requested. OK.

## B2 — image culling `onlyRenderVisibleElements` (NeighborhoodGraphFlow.tsx) — APPLIED, one real gap
- Prop added on `<ReactFlow>`. This is the ONLY behavioral product change with no automated regression net.
- Subflow-safety claim precondition VERIFIED locally: `Handle` is rendered only in NoteNode.tsx (target+source);
  FolderGroupNode.tsx renders NO `<Handle>`. So group parents have no handleBounds — consistent with the
  implementer's "forceInitialRender keeps parents mounted" claim. BUT: this rests on a React Flow v12 INTERNAL
  (`forceInitialRender = !handleBounds`) that is not part of RF's public contract and could change on upgrade.
  No unit/e2e test exercises culling + subflow parent/child positioning + edge culling. Cannot be unit-tested
  in this repo (no .test.tsx / jsdom+RTL infra — confirmed by exploration; standing that up is out of scope).
- flowMapping +3 tests are MAPPING-side precondition guards, not the actual no-refetch behavior:
  - test1 `typeof firstImagePath === "string"` + test3 `undefined when no image` = real discriminator; guards
    the primitive-key contract NoteNode.thumbnailUrl's useMemo depends on. A refactor to an object ref fails test1.
  - test2 "string-equal across independent mappings" is near-tautological (value equality of a passed-through
    primitive is trivially true for a deterministic mapping). Harmless, documents intent. NIT.
  - The describe name "no-refetch-storm contract" slightly over-claims — it pins a NECESSARY precondition
    (stable primitive key), not the runtime no-refetch. Implementer discloses this transparently in the handoff.

## B3 — rebuild debounce tests (GraphViewController.test.ts) — REAL, no leak
- `vi.useFakeTimers({ toFake: ["setTimeout","clearTimeout"] })` + `vi.stubGlobal("window", globalThis)`;
  `afterEach` → `vi.useRealTimers()` + `vi.unstubAllGlobals()`. No global leak.
- setImmediate NOT faked → `flush()` still drains the async pipeline. Sound.
- Coalescing genuinely tested: `FakeGraphSource.build()` pushes to `calls` SYNCHRONOUSLY (line 54), so
  `calls === ["a.md"]` mid-burst proves NO extra build fired; after window elapses `calls === ["a.md","a.md"]`
  proves exactly ONE coalesced rebuild (not five). burstWithinWindow advances 400ms (<500) after each re-arm,
  each iteration clears the prior timer → never fires mid-burst. Correct.
- immediate-cancels-pending verified for BOTH active-file change and settings change (clearDebounce), with a
  post-advance of 2× window proving the cancelled timer never fires (no stray third build).
- The prior "out of scope (needs window)" was a PROSE comment, not a `.skip` test — updated, no silent skip left.

## B4 — structural-diff skip invariant — REAL
- After first (relayout) build, 5 same-id-set rebuilds keep `layout.callCount === 1`. If skip were removed
  (always relayout) it would be 6 → the assertion discriminates. Not tautological. No metrics counter added
  (Pareto-justified; the invariant is the signal).

## B5 — orphan sweep 500-file scale — REAL
- `MIN_WARM_PHASE_YIELDS = floor((500-1)/20) = 24`, matching ChunkedWork's boundary rule (yields at
  20..480, trailing boundary excluded). Assertion `yieldCount >= 24`. If chunking were removed, yields=0 → fail.
  Mirrors the existing sweptFixture wiring (injected async yield counter as the 6th ctor arg). Non-vacuous.
- All-live fixture: seeds NO doc-data → phases 2/3 contribute 0 yields, so total is exactly 24; `>=24` holds.
  Second test asserts summary all-zeros (correctness at scale). Real.

## Cross-cutting
- No hacks, no swallowed failures, no race-masking sleeps found. Fake-timer usage is the correct tool, cleaned up.
- Implementer's "0 tickets" is defensible (every item fixed; no measured defect). The single soft spot is B2:
  its runtime correctness (subflow culling) is unguarded and depends on an RF internal, and the follow-up is
  filed as a loose "open question for TOP_LEVEL" rather than a tracked ticket → [SHOULD] make it a ticket so
  the visual/e2e smoke + RF-upgrade fragility isn't lost.

## Verdict: APPROVE-WITH-NITS. 0 blocking.
