# Private notes for a future clone of this exploration role

## IMPORTANT: this ticket may be substantially DONE already

Ticket 4 (dual presenters, `nid_armoson86j0ii8c33r1odo1rc_e`) already landed
`src/view/settingsRows.ts` with `EVERY_SETTINGS_ROW`, `settingsRowsFor()`, AND two
tests that already do spec-iteration:
- `src/view/settingsRows.test.ts` — walks `EVERY_SETTINGS_ROW` (distinct labels,
  every control kind used, no empty section, `disabledWhen` scope).
- `src/view/settingsRowParity.test.ts` — the tab/panel parity test, already exists,
  already source-scan style (see below for why source-scan, not render-based).

So a naive reading of the ticket-5 title ("iterate the descriptor list instead of
hand-enumerated literals; parity test tab-vs-panel") could look ALREADY DONE at
the row-model layer. What is NOT done, and is the real gap:

1. **`src/engine/SettingsSpec.test.ts`** (290 lines) still has the two giant
   hand-typed `toEqual` literal blocks — "defaults equal the exact shipped
   baseline" and "limits equal the exact shipped baseline" — that are LITERALLY
   the two tests that went stale in both linked staleness tickets
   (`ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md`,
   `ticket-settings-baseline-tests-stale-after-spacing-change.md`). These ARE
   backed by compile-time completeness guards (`EverySpecField<T>`,
   `SpecLimitsBaseline<T>` via `satisfies`), so a NEW field can't silently skip
   the baseline — but a CHANGED value (e.g. `linkStrengthFactor.max: 2 -> 4`)
   still requires someone to notice the test failure and manually retype the
   literal. This is the actual staleness class the owner is naming.

2. **`src/engine/forceLayoutSettings.test.ts`** has the same duplicate literal
   ("EngineDefaults.forceLayoutSettings shipped baseline") — it repeats (in a
   second file) exactly the `forceLayout` defaults block that's already in
   `SettingsSpec.test.ts`. Two places to update per drift.

3. My best read of what an actual "spec-iterating test" replacement looks like:
   instead of `expect(SETTINGS_SPEC...).toEqual({ <200 lines of hand literals> })`,
   write tests like:
   - "every bounded field's default is inside its own [min,max]" — iterate
     `Object.values(SETTINGS_SPEC.globalView.forceLayout)` etc. and assert
     `min <= default <= max` structurally, no literals.
   - "every bounded field clamps its own out-of-range values to its own bounds"
     — already exists for forceLayout (`forceLayoutSettings.test.ts` lines 33-52,
     iterates `FORCE_LAYOUT_RANGES`) — GOOD TEMPLATE, generalize it to sizing
     bounds and depth bounds too (currently sizing/depth bound-clamping is only
     tested indirectly via `persistedShapes.test.ts`, not directly against the
     spec the way forceLayout is).
   - "adapters (`EngineDefaults.*`, `FORCE_LAYOUT_RANGES`, `SIZING_RANGES`,
     `DEFAULT_*`, `MIN_*`) are exact structural projections of `SETTINGS_SPEC`"
     — ALREADY entirely spec-iterating in `SettingsSpec.test.ts`'s "adapters
     derive from SETTINGS_SPEC" describe block (lines 191-260) — good, keep as
     is, these are NOT literal-pinned (they compare spec-to-adapter, not
     spec-to-hand-literal).
   - KEEP as literal `toBe`: the short explicit list the owner named + implied
     by "product-meaningful" doc comments in `SettingsSpec.ts` — my
     recommendation for the keep-list based on comments that give an explicit
     PRODUCT rationale (not just an engineering-safety rationale):
     `nodeCap.default === 100`, `outgoingDepth/incomingDepth.default === 1`,
     `outlineMaxDepth.default === 2`, `nodePreviewPreference.default === "auto"`,
     `own-file-size` metric `enabled: true` and the other four `enabled: false`
     (product decision: which metric ships on), `nodeExclusion.enabled ===
     false` (ships off, opt-in). All the force-layout tuning constants
     (`centerPullStrength`, `repelStrength`, etc.) and ALL bound values (min/
     max/step everywhere) are candidates to move OFF the literal-pin list and
     onto structural invariants instead (default-inside-bounds, clamp-to-own-
     bounds) — these are the ones that drift on every layout-tuning commit and
     have already burned the team twice.
   - This is a judgment call for the implementer/requester; flag it rather than
     silently deciding — the owner may want a DIFFERENT keep-list.

4. **Parity test** (`settingsRowParity.test.ts`) is source-scan-only because
   there's no render harness. Confirmed by grepping: no `@testing-library`,
   no jsdom-render-based test found under `src/view/*.test.ts`. The
   "vitest" config — check `vitest.config.ts`/`package.json` for `environment:
   "jsdom"` if you want to confirm whether jsdom IS available as an environment
   even without a component-render test yet (didn't check this explicitly —
   worth a quick `grep -n environment vitest.config.*` before assuming it's a
   large lift). The open ticket `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` (decide:
   React component-test infra) is UNRESOLVED per settings.md — do NOT assume
   ticket 5 should add a render harness; that's explicitly a separate,
   ordering-undecided ticket. A real "accessible names / order / disabled
   state" parity assertion needs it; without it, stick to source-scan-style
   structural checks (which the existing file already does well) plus maybe
   deepen coverage (e.g. assert EVERY row's label string appears in BOTH
   presenter source files literally, catching a row whose text diverged
   between tab/panel).

## Other loose threads worth flagging back to the requester

- `src/view/settingsWritePlan.test.ts` (151 lines) and `src/view/
  settingsValidation.test.ts` (73 lines) were NOT read in depth this pass —
  quick skim only via `wc -l`/grep. Read fully before writing new tests in
  case they also carry hand-literal blocks worth genericizing.
- Ticket 6 (`nid_fay1hu5sxcoygizopkkg0f0d7_e`, "embedded-outgoing-link depth
  field") is the NEXT step after 5 and is explicitly "the proof step" that
  measures cost of adding one field under the new model — whatever spec-
  iterating test shape ticket 5 lands should be exercised/kept green when that
  field is added, so err toward genuinely structural (walks the spec/row list)
  rather than re-hand-listing fields under a different name.
- No dedicated ticket-5 markdown file exists in `docs-internal/tickets/`
  (only settings.md's chain table + the two closed staleness tickets
  reference it by id). If the requester expects a ticket doc, it isn't
  there — may be intentionally tracked only in an external ticket system
  (the `ticket ready -T settings-cleanup` CLI commands mentioned at the top
  of settings.md imply an external tool, not files in this repo).
- `.tmp/planprobe/` contains a STALE parallel copy of much of `src/` (from an
  earlier planning pass) including a stale `CentralDepthRoundTrip.test.ts`,
  a stale `settingsRows.ts` etc. Do NOT read these as current state — always
  read from `src/` and `e2e/` at repo root, never `.tmp/`.
- `SETTINGS_SPEC.test.ts`'s two giant literal blocks are ALSO the closest thing
  to a canonical "one object listing every settings field's default/limits" —
  if the implementer replaces them entirely with structural per-field loops,
  double check nothing else in the repo relies on eyeballing that file as
  living documentation of "what are all the settings and their values" (it
  reads that way today, semi-deliberately, per its own docblock: "mirrors the
  persisted PluginData type shape ... so any default/bound is trivial to
  locate"). A fully generic loop-based test loses that documentation value —
  might be worth keeping ONE reference literal snapshot test (e.g. a single
  `toMatchInlineSnapshot()` or similar) alongside the structural ones, but
  that's a design opinion to surface, not decide unilaterally.

## Commands used / verification trail

- `npm test` on HEAD `fdf4214ea3b43450fe06ef0ecc34914538cdf16a`: 87 files,
  1139 tests, all passed. Log at repo-root `.tmp/explore-test.log` (not
  committed, per CLAUDE.md temp-file convention).
- `git log --oneline --all -- src/adapters/CentralDepthRoundTrip.test.ts` →
  only shows it existing in old history; current `ls src/adapters/` has no
  such file. Its removal commit: `347dc77` "refactor(persistence): delete the
  doc-data store — data.json is the only persisted file".
