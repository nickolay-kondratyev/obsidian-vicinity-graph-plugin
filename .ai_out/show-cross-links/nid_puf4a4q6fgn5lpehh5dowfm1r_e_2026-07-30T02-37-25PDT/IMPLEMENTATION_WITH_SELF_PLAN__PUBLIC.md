# "Show cross links" — implementation (ticket `nid_puf4a4q6fgn5lpehh5dowfm1r_e`)

## What shipped

A GLOBAL boolean setting **"Show cross links"**, **default OFF**, present on BOTH
surfaces (settings tab + in-graph controls panel) by construction.

- **OFF** — byte-for-byte today's graph: an edge exists only where the BFS walked a link.
- **ON** — after truncation, the engine sweeps the visible node set and emits the
  **induced subgraph** (every link whose source AND target are both visible), including
  links the walk never traversed. Cross links are rendered, counted and collapsed
  **identically** to walked edges — no provenance flag, no styling seam, same
  `provider.getLinkCount` path with the `Math.max(1, …)` floor.
- **Node selection is unaffected** — sizing and the truncator's distance-to-MAIN ranking
  still run on the WALKED edge set, so the visible node set is identical either way.
  Stated in the code (`CrossLinkSweep`'s class doc and `VicinityEngine.visibleEdges`) as
  a requirement, not an accepted limitation, so nobody "fixes" it later.

## Files changed (repo-relative)

**Engine**
- `src/engine/CrossLinkSweep.ts` (**new**) — the induced-subgraph sweep. Separate from
  `EdgeCounts` (SRP: one owns pair SELECTION, the other multiplicity).
- `src/engine/CrossLinkSweep.test.ts` (**new**) — 6 BDD cases.
- `src/engine/VicinityEngine.ts` — one private `visibleEdges()` makes the walked-vs-induced
  choice, post-truncation.
- `src/engine/EdgeCounts.ts` — input field `walkedVisibleEdges` → `visibleEdges`; the doc
  comment the ticket called out now describes the TOGGLE instead of a fixed rule.
- `src/engine/types.ts` — `ViewSettings.showCrossLinks`; `GraphEdge` doc updated.
- `src/engine/SettingsSpec.ts`, `src/engine/constants.ts`, `src/engine/index.ts`.
- `src/engine/settingsProductDefaults.test.ts` — the ONE literal-defaults tripwire gains
  `globalView.showCrossLinks: false`.
- `src/engine/EdgeCounts.test.ts`, `src/engine/VicinityEngine.test.ts` — new cases.

**Persistence**
- `src/persistence/persistedShapes.ts` — boolean parse (non-boolean ⇒ absent ⇒ spec
  default; never a truthiness coercion). `persistedShapes.test.ts` fixture extended.

**View (one declared model, both presenters by construction)**
- `src/view/settingsRows.ts` — control kind `show-cross-links`, new **`edges`** section
  with the row `Show cross links`.
- `src/view/settingsSectionFields.ts`, `src/view/settingsResetPlan.ts` — new section +
  its reset scope ("Restore edges defaults"), and the tab-wide description enumerates it.
- `src/view/settingsRowAccessors.ts`, `src/view/settingsWritePlan.ts` (interaction
  `global-show-cross-links`), `src/view/settingsWriteFailureNotice.ts`.
- `src/view/VicinityGraphSettingTab.ts` — a reusable `addToggleRow()` arm.
- `src/view/SettingsRowView.tsx` — shared `ToggleRow` component; the exclusion toggle now
  uses it too (clean break: CSS class `vicinity-graph-exclusion__toggle-row` →
  `vicinity-graph-toggle-row` in `src/view/graph-view.css`).
- Tests/fixtures touched for the new kind/field: `settingsRowAccessors.test.ts`,
  `settingsRowSpecCoverage.test.ts`, `settingsWriteFailureNotice.test.ts`,
  `settingsSectionFields.test.ts`, `testFixtures/graphFixtures.ts`.
- `e2e/settingsBaseline.ts` (+ `.test.ts`) — the compile-forced per-section record and the
  deliberate copy second-opinion list.

**Docs / ticket**
- `README.md` (settings model + the new bullet), `docs-internal/plan/high-level-plan.md`
  (the toggle is now the design source of truth, superseding step-02 CLARIFICATION Q5),
  ticket noted + closed.

## Key decisions & deviations

1. **No cascade — global only.** The ticket's "full cascade: global / MAIN / pinned
   override" is STALE (per-doc layer removed; CLAUDE.md: "Nothing is per-document").
   Shipped as a plain global boolean, on the top-level agent's instruction.
2. **A NEW settings section "Edges"** rather than putting the row under
   *Depth (all notes)* or *Node contents* — both headings would misname a setting about
   what is drawn BETWEEN nodes. Precedent: *Performance* is also a one-row card. This is a
   UX call the owner may want to review; it cost the section's reset scope + copy.
3. **Sweep is its own class**, so `EdgeCounts` remains the single multiplicity authority
   and the toggle's branch lives once, in the engine facade.
4. **No migration** (pre-release clean break): an old `data.json` simply has no
   `showCrossLinks` key and falls back to the spec default `false`.
5. Reset copy deliberately does NOT restate the default value (that literal lives only in
   `SETTINGS_SPEC` + the defaults tripwire).

## Test results

- `npm test` — **97 files / 1304 tests, all pass** (log: `.tmp/test.log`).
- `npm run check` — `tsc -noEmit` for `src/` **and** `e2e/`: **clean** (log: `.tmp/check.log`).
- Started red: the new `CrossLinkSweep`/engine cases failed before implementation.
- No existing behavior-capturing test was weakened or deleted. `npm run test:e2e`
  (real Obsidian) was NOT run — it is the release gate, not part of this task.

## Open risks

- `e2e/settingsBaseline.ts`'s `SUMMARY_ALSO_MATCHES_AN_ANCESTOR` entry for the new section
  is set to `false` (no other panel disclosure's text contains "Edges"). Unverified against
  a real DOM here — the e2e gate is where that would surface.
- The new "Edges" card adds a seventh per-section restore row to the settings tab; any
  future e2e that hard-counts restore rows derives its count from the model, so it should
  follow automatically.
