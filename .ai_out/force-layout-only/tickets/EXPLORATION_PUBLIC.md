# EXPLORATION_PUBLIC — force-layout-only (remove layered + radial)

Ticket: `_tickets/01-force-layout-only-remove-layered-and-radial-layout-modes.md`
(id `nid_ihlfchb69wt1hqot6iqy7a9m9_e`). Branch `tickets`. Follow-on ticket
`_tickets/02-remove-edge-routing-setting-obstacle-avoidance-always-on.md` depends
on this one (`deps: [nid_ihlfchb69wt1hqot6iqy7a9m9_e]`) and confirms the
`isRoutingSkippedLayout` radial guard is removed here.

## Decision resolutions (by TOP_LEVEL_AGENT, from acceptance criteria)

1. **Full removal, not collapse.** Acceptance criterion says *"No LayoutMode
   symbol remains"* → delete the `LayoutMode` type, `LAYOUT_MODES`,
   `DEFAULT_LAYOUT_MODE`, and the `layoutMode` field from `ViewSettings` /
   `ViewSettingsOverride` entirely. Do NOT keep a fixed always-`"force"` field.
2. **`ELK_DIRECTION` stays** (redocumented). `ELK_GROUP_MEMBER_OPTIONS` (which
   the ticket says stays — folder-group members are laid out with elk `layered`)
   uses `ELK_DIRECTION` at constants.ts:157. Keep the constant, re-document it as
   "direction for the group-member layered pass". `ELK_LAYER_SPACING` is used
   ONLY by `ELK_LAYERED_ROOT_OPTIONS` → delete it with that block.
3. **Version bump: DO NOT bump `PERSISTED_SHAPE_VERSION`.** It has stayed at `1`
   through three prior additive changes to these shapes (node exclusion, edge
   routing, layout modes). The parser degrades unknown/removed fields per-field
   (`LAYOUT_MODES.find(...) === undefined` → falls back to default), so old
   persisted `"layered"`/`"radial"` values already load without error. Bumping
   would be inconsistent with the established convention and adds no value. This
   is a documented deviation from the ticket's "bump per persistence convention"
   wording — see CALLOUTS.
4. **Docs:** only `docs-internal/architecture-map.md:47` and
   `docs-internal/specs/graph/arrows.md:47-50,81` actually mention layout modes.
   `high-level-plan.md` and `README.md` do NOT mention layout modes — no edit
   needed there (ticket's doc-target list was optimistic).

## File-by-file map (line numbers current as of exploration)

### Engine (pure — no obsidian/react)
- `src/engine/types.ts`: `LayoutMode` union (140), `LAYOUT_MODES` (143),
  doc comment (132-139), `ViewSettings.layoutMode` field (212). Remove all.
- `src/engine/index.ts`: `LayoutMode` type re-export (46), `LAYOUT_MODES` value
  re-export (57), `DEFAULT_LAYOUT_MODE` re-export (89). Remove all three.
- `src/engine/constants.ts`: import of `LayoutMode` (4), `DEFAULT_LAYOUT_MODE`
  decl + doc (41-47), usage in `EngineDefaults.viewSettings()` (95). Remove.
- `src/engine/ViewSettingsResolver.ts`: `layoutMode: field("layoutMode")` (50).
  Generic cascade — remove just this line.

### View
- `src/view/LayoutSection.tsx`: ENTIRE FILE is the toolbar layout `<select>`
  (single-option after removal → useless). DELETE the file. Remove its usage in
  `src/view/GraphToolbar.tsx` (import line 4, `<LayoutSection .../>` at ~54).
- `src/view/settingsWritePlan.ts`: `LayoutMode` import (5), `global-layout` union
  member + doc (41-42), `case "global-layout"` (97-98). Remove.
- `src/view/constants.ts`: DELETE `ELK_LAYERED_ROOT_OPTIONS` (79-85),
  `ELK_RADIAL_ROOT_OPTIONS` (94-97), `ELK_ROOT_OPTIONS_BY_MODE` (142-147),
  `ELK_LAYER_SPACING` (70). KEEP `ELK_FORCE_ROOT_OPTIONS` (104-107),
  `ELK_GROUP_MEMBER_OPTIONS` (155-159), `ELK_DIRECTION` (64, redocument),
  `ELK_NODE_SPACING`, `ELK_ROOT_ID`. Remove `LayoutMode` import (1).
- `src/view/elkMapping.ts`: reads `mode = graph.viewSettings.layoutMode` (33) and
  branches on `mode === "layered"` in THREE places — container `layoutOptions`
  (51-54), root-edge construction (72-75), root options lookup (78). With layered
  gone all three take the else-branch: DROP the `mode` variable entirely, always
  use `ELK_GROUP_MEMBER_OPTIONS` for containers, always `projectedRootEdges`,
  and `layoutOptions: { ...ELK_FORCE_ROOT_OPTIONS }` for the root. Rewrite module
  doc (20-30) and `projectedRootEdges` doc (84-95) to drop radial/layered framing
  (logic stays — it's now unconditional).
- `src/view/GraphViewController.ts`: `LayoutMode` import (1); gate at 248
  `if (!edgeRouting || isRoutingSkippedLayout(layoutMode))` → simplify to
  `if (!graph.viewSettings.edgeRouting)`. Delete `ROUTING_SKIPPED_LAYOUT_MODE`
  (367) + `isRoutingSkippedLayout` (369-371) + their doc.
- `src/view/GraphStructureDiff.ts`: references `layoutMode` in doc (16) and a
  comparison (33) — verify & remove the layoutMode comparison term.

### Persistence
- `src/persistence/persistedShapes.ts`: `LAYOUT_MODES` import (11), `layoutMode`
  parse block (145-148). Remove. Do NOT bump version (decision #3).

### Test fixtures (KEY hidden coupling)
- `src/view/testFixtures/graphFixtures.ts`: `makeViewSettings()` defaults
  `layoutMode: "layered"` (51) — deliberately decoupled from engine's `"force"`
  default so implicit tests capture layered behavior. Remove the field.
  `withLayoutMode` helper (79-82) + `LayoutMode` import (1) — remove.
  **Consequence:** every `elkMapping.test.ts` / `ElkLayout.test.ts` test using
  `makeGraph()` without explicit `withLayoutMode(...,"force")` is *silently* a
  layered test today. After removal they exercise force behavior (cross-boundary
  edges switch from raw pass-through to projected/deduped/flipped). Expectations
  must be re-verified, not just mechanically edited.

### Tests to update (human-approved removal of layered/radial behavior tests)
- `settingsWritePlan.test.ts:78-83`: delete the `global-layout` test.
- `persistedShapes.test.ts:45-53`: both tests are generic (unknown mode → force);
  keep or trim for clarity. Remove `layoutMode` from `parseViewOverride` coverage.
- `GraphViewController.test.ts:458-468`: delete radial routing-skip test; check
  `withLayoutMode` import (11) removable.
- `elkMapping.test.ts`: layered assertions (14-20), folder-group block (57-108
  uses implicit layered default → re-verify), radial/force block (110-167 →
  promote force assertions, drop radial). `withLayoutMode` import (6).
- `ElkLayout.test.ts`: radial hub block (78-145) + radial folder block (147-180)
  → delete radial, keep/rewrite force + group coverage.
- `D3ForceLayout.test.ts` (**KEEP file** but still edit): line 87-91 compares
  `hubGraph("force")` vs `hubGraph("radial")` — drop the radial comparison;
  `describe(... non-force modes)` block 145-152 uses `hubGraph("layered")` —
  delete. Simplify `hubGraph(mode)` to zero-arg.
- `GraphStructureDiff.test.ts:77-81`: layoutMode-diff assertions — update.

### Docs
- `docs-internal/architecture-map.md:47`: "Layout modes: layered|radial|force" →
  force-only (note group members still use elk layered internally).
- `docs-internal/specs/graph/arrows.md:47-50,81`: remove radial routing-skip
  bullet + the "web-worker radial routing" follow-up (radial gone; routing now
  unconditional when edgeRouting on).

### Stale tickets to close/supersede
- `_tickets/layout-mode-optional-per-doc-override-ui-settings-tab-surface.md`
  (id `nid_fqb570fmygcijuer2cjxtbana_E`) — per-doc layoutMode override; target
  field no longer exists.
- `_tickets/edge-routing-re-enable-radial-routing-via-web-worker-offload.md`
  (id `nid_si26o1o5h4yrvv5v8tcgz1b68_e`) — radial no longer exists.

## Acceptance criteria (from ticket)
- `npm test` and `npm run check` pass.
- No `LayoutMode` symbol remains; toolbar has no layout selector; force pipeline
  (elk force seed + d3 refinement) unchanged.
- Old persisted `layoutMode` values load without error.
