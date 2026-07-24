# IMPLEMENTATION REVIEW — Settings defaults + limits centralization

## Verdict: APPROVE

Clean, well-scoped structural refactor. Every shipped default and bound is
byte-identical to the pre-refactor values, requirements are fully met, engine
purity is preserved, and the new test genuinely pins both defaults and limits.
One MINOR defensive-copy observation (non-blocking, pre-existing-safe).

## Independent verification

- `npm run check` (tsc -noEmit, strict) → **exit 0**.
- `npm test` → **exit 0**, 62 files / 739 tests passed (includes `importGuard.test.ts`,
  `forceLayoutSettings.test.ts`, `persistedShapes.test.ts`, `settingsResolvers.test.ts`,
  and the new `SettingsSpec.test.ts`).

## Value-drift check: **PASS**

Cross-checked every `SETTINGS_SPEC` leaf against the pre-refactor `constants.ts`
(HEAD~1) and `view/constants.ts`. All identical:

| Field | Default | Bounds | Match |
|---|---|---|---|
| outgoing/incomingDepth | 1 / 1 | min 0, max 5, step 1 | ✓ |
| nodeCap | 100 | min 1 | ✓ |
| groupByFolder | true | — | ✓ (folded from inline literal) |
| edgeVisibility | walked-from-center | — | ✓ |
| sizing.metrics | own-file-size on, other 4 off, weight 1 | — | ✓ |
| depthDecayK / minPx / maxPx | 1 / 40 / 160 | — | ✓ |
| centerPullStrength | 0.05 | 0 / 0.15 / 0.01 | ✓ |
| repelStrength | 300 | 50 / 1000 / 10 | ✓ |
| linkStrengthFactor | 1 | 0.25 / 2 / 0.05 | ✓ |
| linkGapPx | 40 | 10 / 150 / 5 | ✓ |
| collidePaddingPx | 20 | 0 / 80 / 5 | ✓ |
| elkNodeSpacingPx | 40 | 10 / 120 / 5 | ✓ |
| nodeExclusion | enabled false, patterns [] | — | ✓ |

## Requirements coverage

- Single nested source of truth mirroring `PluginData` shape (`globalDepths` /
  `globalView` → `sizing.metrics`, `forceLayout` / `nodeExclusion`): **met**.
- Defaults + limits co-located per field; renamed to `SettingsSpec.ts` /
  `SETTINGS_SPEC` conveying BOTH: **met**.
- Dummy `SettingsDefaults` navigation shim (re-export + non-instantiable class,
  file doc points to real spec): **met**.
- `EngineDefaults` / `DEFAULT_*` / `FORCE_LAYOUT_RANGES` / `MIN_NODE_CAP` /
  stepper bounds all DERIVE from the spec — the 6 per-field force `DEFAULT_*`
  scalars and file-private `DEFAULT_METRIC_WEIGHT` removed, no duplicated
  literals remain: **met** (verified no external consumers of the removed
  scalars).
- `groupByFolder: true` folded into the spec: **met**.
- JSDoc WHY rationales preserved (moved onto spec fields; force fields merge
  default-WHY + range-WHY): **met**.
- Engine purity: `SettingsSpec.ts` / `SettingsDefaults.ts` import only `./types`
  (and `./SettingsSpec`); `importGuard.test.ts` green: **met**.

## Findings

| Severity | Location | Issue | Suggested fix |
|---|---|---|---|
| MINOR | `src/engine/constants.ts:114-125` `EngineDefaults.sizingSettings()` | `metric.default` returns the **same object reference** held inside `SETTINGS_SPEC` on every call, whereas the pre-refactor factory produced fresh `{enabled, weight}` literals each call. `nodeExclusionSettings()` defensively spreads its array (`[...patterns]`) but the metric objects are shared. The whole codebase treats defaults as immutable (settings updates spread-copy: `{...current.metrics[id], enabled}`), and the leaf types are `readonly`, so this is currently safe — but a future in-place mutation of a default metric would silently corrupt the global spec. | For symmetry/robustness, shallow-copy the metric leaf: `[metricId, { ...metric.default }]`. Optional; low risk given the readonly + spread-on-write discipline. |
| NIT | `src/engine/constants.ts:76-82`, `114-118` | Two `as Readonly<Record<...>>` casts around `Object.fromEntries`. Not drift-hiding (the new test pins the projected values), just the standard `Object.fromEntries` typing limitation. | Acceptable as-is. |

## Test adequacy

`SettingsSpec.test.ts` is genuine, not tautological: it asserts the spec's
default values and its limits against hardcoded literals (independent of the
spec), then separately proves `EngineDefaults.*`, `FORCE_LAYOUT_RANGES`, the
`DEFAULT_*` constants, `MIN_NODE_CAP` and the stepper bounds are projections of
the spec, plus `SettingsDefaults.SPEC === SETTINGS_SPEC`. Existing guard tests
are untouched. No behavior-capturing tests removed.

## Documentation Updates Needed

None required. `docs-internal/architecture-map.md` may optionally gain a one-line
pointer to `SettingsSpec.ts` as the settings defaults+limits source of truth, but
this is discretionary.
