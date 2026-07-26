# IMPLEMENTATION_REVIEWER — private rehydration memory

Branch `sizing-nonfinite-clamp`, reviewed `git diff main..HEAD` (`4822bf7` fix, `5e3618b` docs).
Public review: `IMPLEMENTATION_REVIEW__PUBLIC.md` (same dir). Verdict: APPROVED with follow-ups,
0 BLOCKING, 5 SHOULD-FIX, 3 NIT.

## Commands actually run (all from repo root, logs in `.tmp/`)

- `npm run check` → exit 0 (`.tmp/rev-check.log`).
- `npm test` → exit 0, 71 files / 956 tests (`.tmp/rev-test.log`).
- `git diff main..HEAD -- src/` → `.tmp/rev-src.diff` (905 lines; whole review read from it).
- Mutations (python3 string replace in `src/engine/NodeSizer.ts`, `npx vitest run
  src/engine/NodeSizer.test.ts`, then `git checkout` — tree verified clean after):
  - A drop `clampSizingSettings` in `computeSizes` → 3 RED (minPx, maxPx, weight); all 3 `k` GREEN.
  - B drop `Number.isFinite(decayed)` in `DepthDecayMetric` → 22/22 GREEN (guard unpinned).
  - C both → 5 RED; **`k = Infinity` still GREEN** (test is vacuous).

## Facts established by reading source (don't re-derive)

- `VicinityTraversal.ts`: neighbours get `currentDepth + 1` (~line 130); `isCentral =
  rootPaths.has(path)` (line 165); `minDepth = Math.min(...depthTags)` (167). ⇒ `minDepth === 0` ⟺
  root ⟺ `isCentral`. `NodeSizer.computeSizes` line 54 bypasses composition for centrals. So the
  ticket's `Infinity * 0 = NaN` is unreachable at `sizePx`. Ticket premise is factually wrong there.
- Single write choke point confirmed: `VicinityGraphSettingTab.applySizing` (573) →
  `applyInteraction` (582) → `planSettingsWrite`; `SizingSection.applySizing` (33) → same.
  `grep` over src shows no other `SizingSettings` producer. `clampSizingSettings` call sites:
  `NodeSizer.ts:45`, `persistedShapes.ts:192`, `settingsWritePlan.ts:107`.
- `DepthDecayMetric` is module-private (not exported from `NodeSizer.ts`), one construction site,
  which already receives clamped settings ⇒ guard unreachable today.
- Clamping cannot create an inverted `minPx > maxPx` (both clamp into the same `[1,400]`, monotone);
  inversion is pre-existing and only makes the ramp descend — finite, no crash.
- `Number("") === 0` + `Number.isFinite(0)` ⇒ SHOULD-FIX #1 in the settings tab (old guard
  `parsed >= min` rejected it for minPx/maxPx). React panel unaffected (`valueAsNumber` = NaN).
- No `src/view/VicinityGraphSettingTab.test.ts` / `SizingSection.test.tsx` exists (checked `ls`) ⇒
  the 4 duplicated `Number.isFinite` input guards have zero coverage.
- `forceLayoutSettings.test.ts` untouched ⇒ new NaN→default behaviour of `clampIntoRange` unpinned
  for force layout.
- No `ap_*_E` anchor removed (`git diff | grep '^-.*ap_..._E'` empty). Test diff purely additive.
- No stale `ForceLayoutRange` references left in `src/` (only historical `.ai_out/` docs).
- README does not quote sizing numerics ⇒ no doc update mandated.

## If resumed

Open items I asked for: (1) blank-input rejection in the settings tab, (2) extract+test one pure
input parser, (3) honest comment on the `DepthDecayMetric` guard, (4) rename/re-comment the
`k = Infinity` test + correct the ticket, (5) one NaN test for `clampForceLayoutSettings`.
Follow-up ticket candidates: `minPx <= maxPx` invariant, clamp-on-blur for the controlled fields.
