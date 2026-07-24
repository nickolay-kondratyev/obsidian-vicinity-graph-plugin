# IMPLEMENTATION — ticket-04 force-layout tuning sliders (PUBLIC)

Status: **COMPLETE**. `npm test` 60 files / 722 tests PASS, `npm run check` PASS,
`npm run build` PASS. Logs: `.tmp/t04-test-final.log`, `.tmp/t04-check.log`, `.tmp/t04-build.log`.
Nothing committed (per instructions — TOP_LEVEL_AGENT commits).

## What was implemented

New atomic `ViewSettings.forceLayout: ForceLayoutSettings` (mirrors the `sizing`
pattern: pinned/inherited wholesale), wired end-to-end, with 6 sliders in the
settings tab (4 native-parity + 2 advanced), live re-layout, restore-defaults,
clamped ranges, defensive persistence.

### Ranges / defaults table (single source of truth: `src/engine/constants.ts`)

| Field (engine)        | UI label (native parity)   | Default | Min  | Max  | Step |
|-----------------------|----------------------------|---------|------|------|------|
| `centerPullStrength`  | Center force               | 0.05    | 0    | 0.15 | 0.01 |
| `repelStrength`       | Repel force                | 300     | 50   | 1000 | 10   |
| `linkStrengthFactor`  | Link force                 | 1       | 0.25 | 2    | 0.05 |
| `linkGapPx`           | Link distance              | 40      | 10   | 150  | 5    |
| `collidePaddingPx`    | Node spacing (advanced)    | 20      | 0    | 80   | 5    |
| `elkNodeSpacingPx`    | Group member spacing (adv.)| 40      | 10   | 120  | 5    |

Defaults = the exact ticket-03 shipped constants. Ranges live once in
`FORCE_LAYOUT_RANGES` (WHY comments per field, incl. the anti-collapse invariant:
`centerPullStrength.max (0.15) < linkStrengthFactor.min (0.25)` — asserted by a test).

## Key decisions + WHY

1. **`repelStrength` stored POSITIVE**, negated at the d3 `forceManyBody` call
   (WHY comment there). POLS for sliders and hand-edited JSON — "repel 300" is
   intuitive; a negative-range slider would move the wrong way vs the native graph.
   `-(300) === -300` — bit-identical.
2. **`linkStrengthFactor` is a MULTIPLIER on d3's default per-link strength**
   (`1 / min(degree(source), degree(target))`), not an absolute constant. The
   ticket requires the new explicit `forceLink.strength()` override to reproduce
   the previously-unset d3 default at the slider's default: factor 1 computes the
   exact same expression d3's internal default does (link counts replicated in
   `d3ForceRefinement.ts`), so it is bit-identical, and the knob scales sensibly
   across hubs of any degree.
3. **Clamping at persistence parse too** (`parseForceLayout` clamps with the same
   `FORCE_LAYOUT_RANGES` the sliders use): AC says degenerate combos must be
   UNREACHABLE — sliders clamp by construction, the parser closes the
   hand-edited-JSON path. (Deviation from the existing sizing parser, which does
   not clamp — deliberate, AC-driven.)
4. **Live effect via `decideLayout`**: the structural diff previously reused
   positions when nodes/edges were unchanged, which would have silently swallowed
   slider changes. Added a force-layout value-equality check (mirrors the
   existing `groupByFolder` relayout trigger). This was NOT in the exploration
   doc — reviewers should note it as the critical live-effect enabler.
5. **`GraphLayoutRunner.layout(graph, forceLayout = EngineDefaults.forceLayoutSettings())`**
   — optional param defaulting to ENGINE defaults so the ticket-03 stranding test
   and D3ForceLayout test stay literally untouched (ticket requirement). Not a
   silent fallback: the default IS the shipped default, documented on the runner
   and the `GraphLayoutPort` port; threading is guarded by
   `GraphLayoutRunner.test.ts` (non-default linkGapPx ⇒ different positions;
   explicit defaults ⇒ identical positions).
6. **elk spacing read from `graph.viewSettings.forceLayout` inside
   `vicinityGraphToElk`** (the graph already carries resolved viewSettings —
   same route `groupByFolder` takes); d3 params travel via the layout-runner
   parameter since `ElkNode` carries no settings. One knob drives BOTH elk
   passes (group internals + root seed), matching the old single
   `ELK_NODE_SPACING` constant (knowledge stays deduplicated).
7. **No persistence version bump** (stays 2): missing `forceLayout` in old files
   parses to engine defaults per-field — the same backward-compat path `sizing`
   uses. Covered by a test.
8. **Advanced section = native `<details>`/`<summary>`** (Obsidian's Setting API
   has no collapsible group); plainly labeled "Advanced spacing". No custom CSS.
9. **Kept INTERNAL per ticket**: `D3_FORCE_COLLIDE_ITERATIONS` (still a view
   constant, WHY extended), `ELK_GROUP_PADDING`, alphaDecay/tick count, elk seed
   params — untouched.
10. WHY comments for the tunables MOVED from `src/view/constants.ts` to
    `src/engine/constants.ts` next to the values (values must live in engine for
    the settings cascade; engine stays pure — plain numbers only).

## "No default behavior change" verification (stronger than tests)

Beyond the untouched-and-green stranding metric test: a temporary probe test
dumped full-precision laid-out positions (stranded-hub + 24-neighbor fan-out
fixtures, real elk+d3 pipeline) on this working tree AND on a clean `HEAD`
worktree — `diff` byte-identical. Probe and worktree were then deleted.

## Files modified (20) + new (2 tests)

Engine: `types.ts` (ForceLayoutSettings + field), `constants.ts` (defaults,
FORCE_LAYOUT_RANGES, clampForceLayoutSettings, EngineDefaults.forceLayoutSettings),
`ViewSettingsResolver.ts`, `index.ts` (exports), `settingsResolvers.test.ts` (+2),
NEW `forceLayoutSettings.test.ts` (defaults guard, clamping, anti-collapse invariant).
Persistence: `persistedShapes.ts` (parseForceLayout), `persistedShapes.test.ts` (+5).
View: `settingsWritePlan.ts` (+`global-force-layout`), `settingsWritePlan.test.ts` (+1),
`constants.ts` (tunables removed; `elkForceRootOptions`/`elkGroupMemberOptions`
factories; `ELK_FORCE_ALGORITHM`), `elkMapping.ts`, `elkMapping.test.ts` (+2 threading),
`d3ForceRefinement.ts` (params + explicit link strength), `GraphLayoutRunner.ts`,
NEW `GraphLayoutRunner.test.ts` (+2 threading guards), `viewPorts.ts` (port signature),
`GraphStructureDiff.ts` (+relayout on force change), `GraphStructureDiff.test.ts` (+2),
`GraphViewController.ts` (passes forceLayout), `VicinityGraphSettingTab.ts`
(renderForceLayout + slider helper), `testFixtures/graphFixtures.ts` (fixture field).
Docs: `README.md` (settings-model bullet), `docs-internal/CHANGELOG.md` (entry).

## What reviewers should scrutinize

- Range choices (table above) — judgment calls documented at `FORCE_LAYOUT_RANGES`;
  the human will re-tune on real vaults anyway (this IS the tuning harness).
- Decision 5 (optional runner param) — the trade between "stranding test untouched"
  and "required params everywhere"; the threading test is the compensating guard.
- Decision 4 (`decideLayout` change) — any other viewSettings knob that should
  force relayout is out of scope here.

## Deviations from ticket
None of substance. Parser clamping (decision 3) is an addition beyond the sliders,
in service of the "unreachable" AC.

## Follow-ups
None filed — no out-of-scope issues encountered.
