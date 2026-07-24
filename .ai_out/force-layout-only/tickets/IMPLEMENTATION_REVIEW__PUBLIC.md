# IMPLEMENTATION_REVIEW — PUBLIC (force-layout-only)

Ticket `01-force-layout-only-remove-layered-and-radial-layout-modes.md`
(id `nid_ihlfchb69wt1hqot6iqy7a9m9_e`). Reviewed commit `e68a86a`.

## Verdict: **APPROVE**

Blocking issues: **0**. The change is a clean, complete removal of the layered
and radial layout modes with the force pipeline left byte-for-byte intact.

## Gate results (run by the reviewer, not trusted from the implementer)

- `npm run check` (tsc strict): **PASS** (exit 0). Log: `.tmp/review-check.log`.
- `npm test` (vitest): **PASS** — `Test Files 56 passed (56)`, `Tests 697 passed (697)`.
  Log: `.tmp/review-test.log`.

## Sign-off on the required guarantees

1. **No `LayoutMode` symbol remains.** Grep over `src/` for
   `LayoutMode|layoutMode|LAYOUT_MODE|radial|Radial|layered|Layered|ELK_RADIAL|ELK_LAYERED|ELK_LAYER_SPACING|ELK_ROOT_OPTIONS_BY_MODE|ROUTING_SKIPPED|isRoutingSkipped|global-layout`
   returns only legitimate residue:
   - `constants.ts` / `elkMapping.ts` — `elk.algorithm: "layered"` inside
     `ELK_GROUP_MEMBER_OPTIONS` (folder-group members; stays by design).
   - `persistedShapes.test.ts` — one degradation test that feeds a removed
     `layoutMode: "radial"` value to prove old data loads.
   - `docs-internal/CHANGELOG.md` — one historical entry (a record, correctly
     left untouched).
   No `LayoutMode` type, `LAYOUT_MODES`, `DEFAULT_LAYOUT_MODE`,
   `ELK_ROOT_OPTIONS_BY_MODE`, `ELK_LAYER_SPACING`, `ELK_LAYERED_ROOT_OPTIONS`,
   `ELK_RADIAL_ROOT_OPTIONS`, `ROUTING_SKIPPED_LAYOUT_MODE`, or `global-layout`
   remains. `LayoutSection.tsx` deleted; no dangling `LayoutSection` reference.

2. **Force pipeline unchanged.** `ELK_FORCE_ROOT_OPTIONS`,
   `ELK_GROUP_MEMBER_OPTIONS`, and `ELK_DIRECTION` are preserved with identical
   values. The `elkMapping.ts` collapse is correct: with layered gone, all three
   former `mode === "layered"` branches take the previous else-branch that force
   already used — containers always `ELK_GROUP_MEMBER_OPTIONS`, root edges always
   `projectedRootEdges`, root always `ELK_FORCE_ROOT_OPTIONS`. The d3 refinement
   trigger (`GraphLayoutRunner.ts`, not in the diff) still gates on the *actual*
   elk algorithm string (`layoutOptions["elk.algorithm"] === "force"`), which is
   now always true — behavior identical for force. `D3ForceLayout.test.ts` still
   drives the real elk+d3 engines end-to-end and asserts positioning, no-overlap,
   and determinism.

3. **Old persisted values load without error.** `parseViewOverride` drops the
   `layoutMode` field per-field; unknown/removed values are simply ignored. The
   new `persistedShapes.test.ts` test feeds `{ layoutMode: "radial", nodeCap: 7 }`
   and asserts the field is absent while `nodeCap` survives. Correct.

4. **No faked/weakened tests.** Removed tests were genuine layered/radial
   behavior tests (human-approved in the ticket). Rewritten assertions were
   re-derived from real force output — notably the cross-boundary edge test now
   expects the *projected* container ids
   (`folder-group:notes->solo/only.md`, `root.md->folder-group:notes`) instead of
   the old raw pass-through ids, which is the correct force behavior once the
   fixture's implicit layered default was removed. No assertion was loosened to
   force a pass.

## Routing gate

`GraphViewController.ts` gate correctly simplified to
`if (!graph.viewSettings.edgeRouting)`; `ROUTING_SKIPPED_LAYOUT_MODE` and
`isRoutingSkippedLayout` deleted with their doc. No dead radial logic remains.
The radial routing-skip controller test was removed (human-approved).

## Persistence version decision

`PERSISTED_SHAPE_VERSION` was intentionally **not** bumped. This is a documented
deviation from the ticket's "bump per persistence convention" wording, and it is
the correct call: the version has stayed at `1` through three prior additive
shape changes, `version` is only equality-checked in the parsers (never used for
gated branching), and the per-field parser already degrades removed fields
gracefully. Bumping would break that established convention for no benefit.
Well-reasoned; no action needed.

## Non-blocking nits

- None material. Docs (`architecture-map.md`, `arrows.md`) updated accurately;
  `high-level-plan.md` / `README.md` genuinely never mentioned layout modes
  (confirmed), so no edit was needed there.

## Layering / quality

Engine stays pure (no `obsidian`/`react` imports introduced). No leftover dead
code, no unused imports (spot-checked `ElkLayout.test.ts`, `D3ForceLayout.test.ts`,
`GraphViewController.test.ts` — every retained import is still referenced), no
`@Deprecated`. Clean break.

## Stale tickets (for TOP_LEVEL_AGENT, not touched by implementer or reviewer)

- `_tickets/layout-mode-optional-per-doc-override-ui-settings-tab-surface.md`
  (`nid_fqb570fmygcijuer2cjxtbana_E`) — target field gone; close/supersede.
- `_tickets/edge-routing-re-enable-radial-routing-via-web-worker-offload.md`
  (`nid_si26o1o5h4yrvv5v8tcgz1b68_e`) — radial gone; close/supersede.
