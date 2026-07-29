# Ticket: Viewport-culling visual/e2e smoke — folder groups + edges off-screen

**Status:** OPEN
**Origin:** step-07 Phase B review ([SHOULD] finding #1), plus the Phase B B2 change.
**Scope:** verification / test-infra (no known product defect).

## Context

Phase B added `onlyRenderVisibleElements` to `<ReactFlow>`
(`src/view/VicinityGraphFlow.tsx`) so React Flow culls off-screen nodes and
edges on image-heavy / dense vaults. Code analysis found **no** break: RF v12
computes visibility per-node from `internals.positionAbsolute` (folder-group
children are handled correctly), and group members are not DOM children of their
container — `NodeRenderer` renders every visible node as a flat sibling of
`.react-flow__nodes` — so culling a group container cannot take its members with
it.

**But** that safety rests on React Flow **internals** (flat node rendering,
`positionAbsolute` culling) rather than a public contract — it is fragile across
RF upgrades — and there is currently **no automated regression net** for the
culling behavior (no `.test.tsx` infra; it needs a browser / real Obsidian).
Runtime culling of folder-group subflows, parent/child positioning when panned
off-screen, and edge culling are all untested.

## What to do

1. **One-time visual / e2e smoke:** in a display-capable env, pan/zoom a dense,
   folder-grouped, image-heavy vicinity so parts leave the viewport, and
   confirm folder-group boxes, their member nodes, and edges still render
   correctly (nothing vanishes, no orphaned children, edges reappear on pan-back).
2. **Guard against the RF-internal fragility:** if feasible, add an e2e assertion
   (or a note pinning the RF version) so a future `@xyflow/react` upgrade that
   nests group members under their container in the DOM — which would make
   container culling orphan them — is caught.

## Related: revert the e2e sparse-graph workaround

The hover-pin bug
(`_tickets/hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click.md`) is now
**FIXED** (Phase B1). The e2e interaction tests currently click the ALPHA graph (3
large nodes) instead of note1's dense ~11-node graph specifically to dodge that
bug. With B1 fixed, small-node click-to-open should work again, so that workaround
can likely be **reverted** — do this as part of (or a sibling to) the smoke pass,
and re-confirm the dense-graph click test. (Related but distinct from the
pre-existing headless-click flake:
`docs-internal/tickets/ticket-e2e-node-click-flaky-headless.md`.)

## Update 2026-07-21 — culling+fit mount race FOUND and FIXED

The headless e2e suite surfaced a real culling defect: RF's mount-only `fitView`
prop raced Obsidian's pane layout and could compute a garbage viewport (observed
`translate(542px,-11.5px) scale(0.5)` centered where no nodes exist); with
`onlyRenderVisibleElements` that unmounted EVERY node. Fixed by owning the fit:
`FitViewOnLayoutChange` (gated on the RF store's measured pane size, re-fired per
`FlowSnapshot.layoutVersion`) replaced the `fitView` prop, and RF nodes now carry
explicit `width`/`height` so culling/fit math never waits on DOM measurement.
The e2e suite now exercises culling + refit on every rebuild; item 1 above
(visual pan/zoom smoke in a display-capable env) remains open.

## References

- `src/view/VicinityGraphFlow.tsx` (`onlyRenderVisibleElements`)
- `.ai_out/step-07-hardening/step-07-hardening/PHASE_B_IMPLEMENTATION__PUBLIC.md` (B2)
- `.ai_out/step-07-hardening/step-07-hardening/PHASE_B_REVIEW__PUBLIC.md` (finding #1)
- `e2e/vicinityGraph.e2e.ts` (interaction tests / ALPHA-graph workaround)
