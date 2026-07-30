# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket nid_x6hgehsu5il1d1shuraz3ufqy_e (settings-cleanup step 5). Goals 1 + 2. No e2e touched.

## Plan (as executed)

1. One test-support module walks the spec: `src/engine/testFixtures/settingsSpecLeaves.ts`.
2. `src/engine/SettingsSpec.test.ts` rewritten to iterate that walk (structural only).
3. New `src/engine/settingsSpecBounds.test.ts` — bounds, per bounded leaf, with a TOTAL
   field→enforcer mapping.
4. New `src/engine/settingsProductDefaults.test.ts` — the curated literal set.
5. `src/engine/forceLayoutSettings.test.ts` rewritten (7-field literal `toEqual` dropped —
   see "coverage deliberately removed").
6. New `src/persistence/settingsSpecPersistence.test.ts` — parse / round-trip /
   absent→default / garbage→default / sibling-safety, per leaf.
7. New `src/view/settingsResetSpecCoverage.test.ts` — restore-defaults, per leaf.
8. GOAL 2: verified the existing parity test instead of rebuilding it.
9. Proved every structural claim can actually fail (two experiments, below).

## The walk (why it exists, how it works)

`src/engine/testFixtures/settingsSpecLeaves.ts` produces one entry per SETTINGS_SPEC LEAF
(a spec node carrying its own `default`), with `id`/`path`/`default`/`bounds`, plus
read/write/delete helpers over the three persisted settings slices and a per-leaf
ALTERNATE (non-default) value generator.

- Leaf rule keeps `sizing.metrics.<id>` ONE leaf (object default) and `globalView` /
  `sizing` / `forceLayout` / `metrics` composites.
- `globalView.sizing.metricWeight` is declared BOUNDS-ONLY (it declares the bounds shared
  by every metric's `weight`, and has no settings field of its own) — the same exception
  `SettingsSpec.ts` documents on its own completeness guard. Two tests keep that exception
  honest: the id must be a real spec leaf, and no settings field may carry it.
- Numeric alternates use `bounds.min` (falling back to `bounds.max`): every bounded field's
  min differs from its default, is in range by definition, and is an exact JSON number —
  `default + step` would inject float noise (`0.05 + 0.01`) and make assertions about
  arithmetic instead of wiring.
- Garbage uses ONE string sentinel, which is invalid for every leaf type at once, so a
  single test covers all leaves.
- Placed in `testFixtures/` (precedent: `denseVaultFixtures.ts`, `truncationHarness.ts`) so
  it is test support, not production surface; persistence and view tests may import it
  (both already depend on the engine), and the engine never imports them.

## Files touched (repo-relative)

New
- `src/engine/testFixtures/settingsSpecLeaves.ts` — the flat spec walk + fixtures.
- `src/engine/settingsSpecBounds.test.ts` — bounds per bounded leaf + the enforcer mapping.
- `src/engine/settingsProductDefaults.test.ts` — THE curated literal-defaults set.
- `src/persistence/settingsSpecPersistence.test.ts` — every leaf through `data.json`.
- `src/view/settingsResetSpecCoverage.test.ts` — every leaf through restore-defaults.
- `_tickets/decide-should-a-persisted-nodecap-below-its-declared-min-clamp-on-load.md`
  (`nid_5meu9s38sbrv1703na77of4m7_e`, `decide` tag, linked to this ticket).

Rewritten
- `src/engine/SettingsSpec.test.ts` — the two giant `toEqual` baselines and the
  `EverySpecField` / `SpecLimitsBaseline` compile machinery they needed are GONE; the walk
  covers a new field automatically, which is what those types were approximating.
- `src/engine/forceLayoutSettings.test.ts` — defaults now compared to the spec's own
  projection; the whole-object clamp contract stays.

Changed (production, one line + comment)
- `src/engine/constants.ts` — `clampOutlineMaxDepth` now goes through the existing private
  `clampIntoRange`, so `NaN` resolves to the spec default like every other settings clamp.
  Found by the new bounds test (a genuine inconsistency: `Math.min`/`Math.max` PROPAGATE
  NaN, so this clamp handed a `NaN` depth to its caller). NOT a live bug — today's callers
  are sliders and the parse path filters non-finite numbers first; no test pinned the old
  propagation. Finite behavior is byte-identical.

## The curated literal-defaults set, and why

`src/engine/settingsProductDefaults.test.ts` is now the ONLY place a settings default is
written as a literal. Admission rule, stated in the file: a default belongs there only if
changing it changes what a user MEETS on first run, so a silent change would be a product
regression rather than a retune. Pinned: nodeCap 100; both depths 1; outlineMaxDepth 2 and
its 1..6 range; nodePreviewPreference `auto`; `own-file-size` as the sole default-ON metric;
node sizes 40..160px; exclusion OFF with no patterns.

Excluded on purpose: the force-layout tuning constants (`repelStrength`,
`collidePaddingPx`, `edgeRoutingClearancePx`, …). Their measured rationale already lives on
`SETTINGS_SPEC`, they are the values that went stale twice, and the layout-quality suites
(`groupPacking.test.ts`, `d3ForceStranding.test.ts`, `elkMapping.test.ts`) run AT the
shipped defaults and fail on a real placement regression with measured numbers.

## Coverage deliberately REMOVED — called out loudly

`forceLayoutSettings.test.ts` no longer asserts the 7 force-layout defaults as literals
(`centerPullStrength 0.05, repelStrength 300, linkStrengthFactor 1, linkGapPx 40,
collidePaddingPx 50, elkNodeSpacingPx 20, edgeRoutingClearancePx 11`). Its stated claim was
"the default rendered layout did not change" — a claim number-equality never actually made,
and the one that went stale twice on INTENTIONAL retunes. Replaced by: defaults project the
spec, defaults are reachable inside their own ranges, and the measured layout-quality suites
above. **If the owner wants that tripwire back, the cheap move is adding those seven numbers
to the curated file — one line each.** Nothing else was dropped: the spec-limits baseline,
the defaults baseline and the outline-depth 2 / 1..6 pins were all re-expressed (structurally
or as curated literals), and the `EverySpecField`/`SpecLimitsBaseline` compile guards are
subsumed by the walk (verified below).

## GOAL 2 verdict — `src/view/settingsRowParity.test.ts` is sufficient; NOT churned

It already covers the ticket's ask: every declared control kind has a `case` in BOTH
presenter sources, both switches are closed by `unhandledRowControl`, both walkers read
`SETTINGS_GROUPS` and `SETTINGS_SECTIONS` (so no hand-rolled row list), and the model it
checks against is asserted non-empty. Row-level parity FOLLOWS from those two facts: both
surfaces iterate the same declared groups, and rendering is dispatched purely by
`row.control.kind`. I verified it genuinely fails: renaming `case "node-cap":` in
`SettingsRowView.tsx` reddens "every presenter has a `case` for it". The only residual gaps
are DOM-level (rendered accessible names, order, disabled state) which need the undecided
jsdom harness ticket `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` — explicitly out of scope here. No
edits made.

## Proof the structural tests can fail (a test that cannot fail is worthless)

1. Added `globalView.phantomKnob` to the spec and to nothing else → **9 tests across 4 files
   failed**, each naming the field: `EngineDefaults` projection, tab-wide reset, "exactly one
   section owns it", round-trip, absent→default, garbage→default, sibling safety, empty
   `data.json`, and the bounds enforcer mapping. Reverted.
2. Deleted a presenter switch arm AND removed `outlineMaxDepth` from its section's key list →
   parity guard failed, "exactly one section owns it" failed, plus the pre-existing
   `settingsResetPlan` guards. Reverted.

## Verification

- `npm run check` — clean (`.tmp/impl-check.log`).
- `npm test` — **91 files / 1164 tests, all green** (`.tmp/impl-test.log`).
  Baseline was 87 files / 1139 tests.

## Deliberately NOT done

- No e2e touched (typing into a settings input is `nid_ek3wrqoh1rsftk6ulg836mghf_e`).
- No per-doc round-trip/reset tests (per-doc state is gone; owner scope change 2026-07-29).
- No jsdom / @testing-library harness, no render-based parity.
- Bounds are asserted ONCE at the clamp functions, NOT re-asserted on the parse path:
  `persistedShapes.test.ts` already pins which families clamp on load, and duplicating the
  classification would create exactly the two-places-to-update problem this ticket removes.
- `nodeCap`'s declared min is NOT enforced on load. Current behavior is PINNED by
  `persistedShapes.test.ts` ("a stored nodeCap zero survives — falsy is a real value, not an
  absence"), so changing it silently was off the table → filed
  `nid_5meu9s38sbrv1703na77of4m7_e` (`decide`) instead, referenced from the enforcer table.
- `docs-internal/notes/settings.md` not updated — the chain's `change_log` entry and the
  ticket close are TOP_LEVEL_AGENT's step; a one-line "step 5 landed" there is worth adding
  with it.

## Follow-ups worth a ticket

- `nid_5meu9s38sbrv1703na77of4m7_e` (filed) — nodeCap load clamping decision.
- Existing, unchanged: `nid_7qot0m6nuxxmd5z0yb9jylsd6_e` (React component-test infra) is what
  would let the parity test assert rendered names/order/disabled state instead of source text.
