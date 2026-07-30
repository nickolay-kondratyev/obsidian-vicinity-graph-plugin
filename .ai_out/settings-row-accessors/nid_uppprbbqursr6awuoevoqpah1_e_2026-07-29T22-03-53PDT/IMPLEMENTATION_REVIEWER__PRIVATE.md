# IMPLEMENTATION_REVIEWER — private memory

Review of `ef5f163` (ticket `nid_uppprbbqursr6awuoevoqpah1_e`), 2026-07-30. Read-only; nothing edited or committed.

## Gate results (run by me, not trusted from the report)

- `npm test` → 93 files / 1227 tests / exit 0 (`.tmp/rev_test.log`).
- `npm run check` → exit 0, both `src/` and `e2e/` tsconfigs (`.tmp/rev_check.log`).
- No `sanity_check.sh` in repo. `git status` clean.

## Verification trail (so a re-review need not redo it)

Behavior-preservation of "interaction() emits settlesAt(value)":
- `planSettingsWrite` (`src/view/settingsWritePlan.ts:75-105`): `global-sizing-number`,
  `global-sizing-metric-enabled`, `global-sizing-metric-weight` all go through `sizingCommand` →
  `clampSizingSettings`, which clamps metric WEIGHTS too (`src/engine/constants.ts:216-229`).
  ⇒ clamping in `interaction()` is idempotent for those.
- `global-depth`, `global-outline-depth`, `global-cap`, `global-force-layout-field` are stored
  VERBATIM by the plan. Depth: the tab already clamped in its interaction pre-change, and the
  panel's `DepthStepper` clamps before `onChange`. Outline: tab already clamped; panel is a range
  input. Cap/force-layout: `settlesAt` is identity. ⇒ no change anywhere.
- Bounds equality: `DEPTH_STEPPER_BOUNDS = {min:0,max:5,step:1}` shared by all three depth leaves
  (`src/engine/SettingsSpec.ts:140,163,177,178`), and `MIN/MAX_STEPPER_DEPTH` are projections of
  `linkDepthOut` (`src/engine/constants.ts:62-63`). `MIN/MAX_OUTLINE_DEPTH` project the outline
  leaf (`constants.ts:37-38`). So old literals == new spec-derived bounds today.
- Sizing row seed: `write.storedValue()` (live store) → `accessor.read(state)` where `state =
  rowState()` reads the same store inside the same synchronous `display()`. Equal.
- `applyBounds` omits `max` when undefined ⇒ node cap input attribute set unchanged.
- `useOptimisticValue`'s `settlesAt` defaults to identity, so force-layout going from
  `undefined` → `unclamped` is a no-op.

Test-honesty:
- `settingsRowSpecCoverage.test.ts`, `settingsProductDefaults.test.ts` NOT touched (diffstat).
- `settingsRowParity.test.ts` only gained a test; `source()` strips comments, so the new
  `ACCESSOR_OWNED_SYMBOLS` scan cannot be satisfied by prose. It scans only `PRESENTERS`
  (2 files), not `EVERY_ROW_RENDERING_MODULE`.
- New accessor suite is genuinely spec-driven (`EVERY_SETTINGS_ROW` + `unhandledRowControl`
  default), has 3 non-vacuity guards. BUT the "settlesAt promises what the write path stores"
  assertion is tautological for the four accessors that clamp inside `interaction()`.

## Findings I filed (see PUBLIC)

1. IMPORTANT — depth accessor: per-field `bounds` + field-agnostic `clampStepperDepth`;
   `DepthStepper` takes bounds yet still imports the clamp. Latent, not live (all three leaves
   share bounds today) and untestable by the new suite.
2. IMPORTANT — the `settlesAt` assertion is self-fulfilling for clamping accessors; docblock
   over-claims.
3. IMPORTANT — optional `bounds.max`: tab degenerates to `setLimits(min,min,step)`, React input
   silently defaults max=100. IS expressible in the type (slider accessor with required max).
4. Suggestion — `SizingRowWrite.interactionIfAccepted` still spells the literal; the "clamp ahead
   of capNotice" argument does not actually hold because `capNotice` takes the typed value itself.
5. Suggestion — `useSettingsValue`'s optional `settlesAt` passed manually at 3 sites.
6. Suggestion — widen the parity scan to `EVERY_ROW_RENDERING_MODULE` once #1 lands.
7. Process — no ticket close / `change_log` commit (the previous ticket had `bf236b8`).

Docs: `CLAUDE.md` settings paragraph + `docs-internal/architecture-map.md` should name the new
module and the "no engine range table / clamp in a presenter" rule.

Verdict (iteration 0): **READY**, conditional on #1 and #2 being fixed or ticketed. No CRITICAL,
no regression, no weakened guard, no removed test.

---

# Iteration 1 verification — commit `37daba9` → **READY** (unconditional)

Gates re-run by me: `npm test` 93 files / **1230** tests exit 0 (`.tmp/rev2_test.log`);
`npm run check` exit 0 (`.tmp/rev2_check.log`). Tree clean. Their numbers were accurate.

## What I actually verified (do not redo)

- **Rename honesty.** `git show 37daba9 -- src/view/clampStepperDepth.test.ts
  src/view/settingsRowDepthClamp.test.ts`: all six assertions verbatim (-1→MIN, 0→0, 3→3,
  5→MAX, 6→MAX, 2.4→2), retargeted at `SettingsRowAccessors.depth("linkDepthOut").settlesAt`.
  Nothing dropped or loosened. `settingsSpecBounds.test.ts` change is allowlist PROSE only
  (the enforcer table untouched). `optimisticValue.test.ts` simulation same arithmetic.
- **Guard falsifiability — my own probe**, `.tmp/probe*.ts` (deleted after; imported the real
  accessor, edited no source):
  - clamp aimed at WIDER max (7 or 15): "settles inside bounds OR verbatim" **fails**,
    endpoint guard passes.
  - clamp aimed at NARROWER max (4): endpoint guard **fails**, lawless guard passes.
  - real clamp: both pass. ⇒ the two guards are complementary and each bites.
  - GOTCHA for a future probe: mutating max to `max + step*1000` coincides with the probe
    value `beyondBounds` and looks "lawful". Use a small offset.
- **`clampStepperDepth` deletion**: grep over `src/` + `e2e/` shows no callers left (only the
  parity forbidden-symbol list, a pointer comment in `src/view/constants.ts`, and the engine's
  `MIN/MAX_STEPPER_DEPTH`, still pinned by `SettingsSpec.test.ts`). `clampDepthInto` is the
  identical formula over per-field bounds; all three depth leaves share `{0,5,1}` ⇒ no behavior
  change; NaN propagation unchanged.
- **Rejections judged sound.** DI into `SizingRowWrite` unnecessary (static data factory; class
  already imports `SIZING_RANGES` directly) and the literal is single-homed regardless.
  Persistence round-trip correctly declined — that load-path property is
  `settingsSpecBounds.test.ts`'s; their "inside bounds or verbatim" law targets my actual hole
  better than my own suggestion did.
- **Docs accurate**: `ACCESSOR_OWNED_SYMBOLS` scan now iterates `EVERY_ROW_RENDERING_MODULE`
  incl. `DepthStepper.tsx` via the new `ROW_CONTROL_COMPONENTS` table; `SettingsTrackAccessor`
  really does make `nodeCap()` a type error at a slider; architecture-map names three guards
  that all exist.

## Residuals (recorded, explicitly NOT blocking, no ticket asked for)

- Endpoint-reachability guard covers depth rows only; a narrower-than-bounds `outlineDepth`
  clamp would slip past both assertions. Same-leaf derivation makes it moot today.
- `MIN/MAX_STEPPER_DEPTH` are now test-only references — deliberate (spec projection pinned by
  `SettingsSpec.test.ts`), not stale.

Only open item is the coordinator's: ticket close-out + `change_log` entry.
