# IMPLEMENTATION_REVIEW — PRIVATE (a11y toggle labels)

Reviewer: IMPLEMENTATION_REVIEWER. Branch `a11y-toggle-labels`, code commit `25e75f6`, docs `4100d2b`.
Verdict: **READY**. 0 BLOCKING, 0 SHOULD-FIX, 3 NITs.

## What I read
- `.ai_out/.../EXPLORATION_PUBLIC.md`, `.ai_out/.../IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` (did NOT read the
  implementer's PRIVATE file — other role).
- `git diff main..HEAD -- src/ e2e/` (only 2 files: `src/view/VicinityGraphSettingTab.ts`,
  `e2e/settingsUxVisual.e2e.ts`).
- `src/view/VicinityGraphSettingTab.ts` :113-151, :343-372, :495-540, :640-691 (slider builder).
- `e2e/settingsUxVisual.e2e.ts` :225-295. `e2e/settingsDependentRows.e2e.ts` :80-160.
- `src/view/ToggleSwitch.tsx` (in-repo precedent), `src/view/sizingMetrics.ts`.

## Commands run and RAW results
| Command | Result |
|---|---|
| `npm run check` | `CHECK_EXIT=0` (`.tmp/rev-check.log`) |
| `npm test` | `TEST_EXIT=0` — `Test Files 79 passed (79)` / `Tests 1053 passed (1053)` (`.tmp/rev-test.log`) |
| `npm run test:e2e -- settingsUxVisual.e2e.ts` | exit 0 — `17 passed (4.1s)`; includes `:499 WHEN a slider is hovered THEN its current value is readable` ✓ |
| `npm run test:e2e -- settingsDependentRows.e2e.ts` | `DEP_EXIT=0` — `3 passed (1.8s)` |
| `git status --porcelain` | empty (clean tree) |
| `ls e2e/ \| grep -i probe` | no match → probe spec really deleted |
| `git log --name-only -3` | no `.tmp/` or `.out/` artifacts committed |

`sanity_check.sh`: not present in this repo (checked; repo gates are `check` / `test` / `test:e2e`).

## Focus-area findings

### 1. Empirical DOM verification — SOUND
The probe output in the PUBLIC file shows the actual rendered control markup:
`<label class="checkbox-container is-enabled" tabindex="0"><input type="checkbox" tabindex="0"></label>`,
and the `toggleEl` question was settled by a marker attribute (`data-probe-toggleel="1"`) that landed on the
`<label>`. That is a direct, falsifiable experiment against the pinned 1.12.7 binary — not a guess, which is
exactly what the prior ticket refused to do. Two prior assumptions were corrected on record (container is a
`<label>`, not a `div`; it is textless). Corroborating in-repo evidence: `src/view/ToggleSwitch.tsx` (our clone
of Obsidian's markup) also puts `aria-label` on the inner `<input>`.

`querySelector("input")` fallback: returns `HTMLInputElement | null` (tag-name map), the `null` branch is an
explicit no-op with a documented WHY (a missing a11y attribute must not take the settings tab down) and the
loud alarm is the e2e guard, which fails on ANY unnamed checkbox in the tab. This is NOT a silent lie: the
failure mode is detected by a committed test, not swallowed. Acceptable.

Ordering check: `nameToggle` is invoked at the top of the `addToggle` callback, before `setValue`. `Setting.addToggle`
constructs the `ToggleComponent` (and therefore its DOM) before invoking the callback — confirmed empirically by
the green positive assertions.

### 2. Guard non-vacuity — SOUND
- `ANY_UNNAMED_CONTROL` now expands to `input:not([type=radio]):not([aria-label]), select:not(...), textarea:not(...)`.
  A NEW unlabeled toggle added tomorrow renders `input[type=checkbox]` with no `aria-label` → matched → the
  `toHaveCount(0)` assertion fails. Genuinely regression-proof.
- Floor 26 = 10 sliders + 9 numbers + 1 textarea + 6 toggles. Matches exploration's prediction exactly, and the
  arithmetic is spelled out in the doc comment. Empirically satisfied (spec green).
- Positive per-family assertions added: exclusion toggle by label, one sizing toggle by label, and
  `getByRole("checkbox", { name: "Depth decay enabled" })` — the last is the only assertion in the file that
  exercises the browser's own accname computation, which is the right thing to add given the `toggleEl`-is-a-label
  trap. Good judgement.
- Stale comment: the whole `checkbox` bullet naming `nid_d2z2jgt6v49ssej8hxmwd2xi6_e` is gone, replaced by a
  positive statement of why toggles are not exempt. `radio` exemption + rationale preserved verbatim.
- I did NOT re-run the implementer's mutation check (would require editing `src/`, which I'm read-only for). It
  is unnecessary: RED-without-the-fix follows by construction from the probe DOM (6 checkboxes with no
  `aria-label`) plus the negative selector. The implementer's recorded RED trace is consistent with that.

### 3. Naming `${label} enabled` — COMPLIANT, not a deviation
The tab's `nameControl` doc has documented since the prior ticket: "the row name **plus the control's role where
one row holds two controls**". The sizing row holds two controls and the sibling already reads `${label} weight`.
`${label} enabled` is the consistent partner; the visible row name is contained in the accessible name, so the AC
("associated with its visible row name") holds. Bare `label` would additionally make every substring-matching
`getByLabel("Own file size")` strict-mode-ambiguous against `"Own file size weight"`. No human sign-off needed.
The exclusion toggle — the row's only control — correctly gets the bare row name.

### 4. "No visual change" + tooltip — ACCEPTABLE
Diff adds one attribute to six existing inputs; no element/class/text/style added or removed; no CSS touched.
Resting render byte-identical. The hover tooltip is a real hover-state addition, but it is identical in mechanism
to what the number inputs, sliders and reset buttons already shipped with under the PRIOR ticket, which the human
accepted. Implementer disclosed it up front rather than letting me discover it — correct behaviour per
EARN_TRUST. Not contentious enough to block; flagged for awareness only.

### 5. DRY / SRP / consistency — GOOD
One rule, still stated once in `nameControl`'s doc; `nameToggle` is a thin adapter that delegates to it rather
than re-implementing `setAttribute`. Both `addToggle` call sites in the whole of `src/` (grep: exactly 2, at
:355 and :502) are covered. A future sizing metric added to `SIZING_METRICS` flows through `addSizingMetricRow`
and inherits the label automatically. The duplicated "two controls share this row" WHY was consolidated onto the
toggle and cross-referenced from the weight input — a DRY improvement to pre-existing code. The `renderExclusion`
`const name` used for both `setName` and `nameToggle` removes a drift risk.

### 6. `setDynamicTooltip()` — UNTOUCHED
Confirmed present at `src/view/VicinityGraphSettingTab.ts:687` with its full WHY block (:662-670) intact, and the
guarding e2e test (`settingsUxVisual.e2e.ts:499`) passed in my own run.

### 7. Hygiene
Clean tree, no probe spec, no `.tmp/`/`.out/` in any commit, only the two intended product files in `25e75f6`.
No behavior-capturing test removed; no anchor point (`ap_XXX_E`) touched.

## NITs (no action required)
1. The wrapping `<label class="checkbox-container" tabindex="0">` is itself focusable and unnamed, so keyboard
   Tab may land on it before/instead of the named `<input>`. This is Obsidian's own markup and PRE-EXISTS this
   change; "fixing" it (e.g. `tabindex=-1` on the label) risks breaking Obsidian's keyboard activation. Would
   need a fresh probe (focus order + announced name) to even confirm. Optional follow-up ticket at most.
2. `nameToggle`'s null branch is silent — acceptable as argued above; if it ever bothers a maintainer, a
   `console.warn` would be the cheap upgrade. Not worth churn now.
3. Reset buttons' `setTooltip` is now provably redundant with `aria-label`. Implementer explicitly chose not to
   touch prior-ticket reviewed code for zero user gain. Agreed.

## Documentation
No CLAUDE.md / architecture-map update needed (no structural or layering change). Change log entry + ticket
closure are TOP_LEVEL_AGENT's, correctly not done here.
