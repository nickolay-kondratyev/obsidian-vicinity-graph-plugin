# IMPLEMENTATION REVIEW — a11y toggle labels (PUBLIC)

Ticket `nid_d2z2jgt6v49ssej8hxmwd2xi6_e`. Branch `a11y-toggle-labels`, code commit `25e75f6`.

## Readiness: **READY**

**0 BLOCKING · 0 SHOULD-FIX · 3 NIT (no action required).**

This is a clean review. The empirical work is real, the guard is non-vacuous, and the one honest caveat
(hover tooltip) is disclosed rather than glossed. Nothing here needs to change before merge.

## Summary

Six settings-tab toggles (5 sizing metrics + node-exclusion enable) gain an `aria-label` on their inner
`<input type=checkbox>` via a new `VicinityGraphSettingTab.nameToggle`, because `ToggleComponent.toggleEl` was
empirically proven to be the wrapping textless `<label class="checkbox-container">`. The e2e guard drops its
`:not([type=checkbox])` exemption, raises the floor 20 → 26, and adds three positive assertions including one
`getByRole("checkbox", …)`.

## Gate results — re-run by me, not taken on trust

| Gate | My result |
|---|---|
| `npm run check` | **exit 0** |
| `npm test` | **exit 0** — `Test Files 79 passed (79)` / `Tests 1053 passed (1053)` |
| `npm run test:e2e -- settingsUxVisual.e2e.ts` | **exit 0** — `17 passed (4.1s)` |
| `npm run test:e2e -- settingsDependentRows.e2e.ts` | **exit 0** — `3 passed (1.8s)` |
| `git status --porcelain` | clean; `e2e/_probe.e2e.ts` gone; no `.tmp/`/`.out/` in any commit |

No `sanity_check.sh` in this repo. All claims in the implementation PUBLIC file that I could check independently
held up.

## Findings

### 🚨 BLOCKING
None.

### ⚠️ SHOULD-FIX
None.

### 💡 NIT (optional, no action expected)

1. **`<label class="checkbox-container" tabindex="0">` is itself focusable and unnamed.**
   `src/view/VicinityGraphSettingTab.ts:146` names the inner input, which is correct, but Obsidian's wrapper
   label also carries `tabindex="0"`. Failure scenario: a keyboard/screen-reader user may land on the unnamed
   wrapper before the named checkbox. This **pre-exists this change** and is Obsidian's own markup — forcing
   `tabindex=-1` on it would risk breaking Obsidian's keyboard activation, and confirming the actual focus order
   needs a fresh probe. If it matters, file a follow-up ticket; do not widen this change.

2. **`nameToggle`'s `null` branch is silent** (`src/view/VicinityGraphSettingTab.ts:147-150`). I accept this: the
   WHY is documented, and the failure is caught loudly by the committed e2e guard, so it is not a swallowed
   error. A `console.warn` would be the cheap upgrade if a maintainer ever wants one.

3. **Reset buttons' `setTooltip` is now provably redundant** with `aria-label` (per your own probe). Agreed with
   your call to leave prior-ticket reviewed code alone for zero user-visible gain.

## Verdict on each review question

**1. Empirical verification — sound.** The `data-probe-toggleel="1"` marker experiment on the pinned 1.12.7
binary is a direct falsifiable test, not a guess, and it corrected two assumptions on record (container is a
`<label>`, not a `div`; it is textless). Corroborated in-repo by `src/view/ToggleSwitch.tsx`, which puts
`aria-label` on the input in our own clone of the same markup. `querySelector("input")` is typed
`HTMLInputElement | null` and the null branch is a documented no-op backed by a loud e2e alarm — acceptable.

**2. Guard — genuinely non-vacuous.** `ANY_UNNAMED_CONTROL` now expands to include
`input:not([type=radio]):not([aria-label])`, so a new unlabeled toggle added tomorrow is matched and the
`toHaveCount(0)` assertion fails. The floor 26 (10 sliders + 9 numbers + 1 textarea + 6 toggles) matches the
exploration prediction and is satisfied empirically. The stale block comment naming this ticket id is fully
removed and replaced with a positive rationale; the `radio` exemption and its rationale are untouched. The
`getByRole("checkbox", { name: … })` assertion is the right addition — it is the only one that would have caught
an `aria-label` parked on a role-less element, which is exactly the trap `toggleEl` sets.

**3. Naming — compliant, no human sign-off needed.** `nameControl`'s doc already states the rule as "the row
name **plus the control's role where one row holds two controls**", and the sibling has read `${label} weight`
since the prior ticket. `${label} enabled` is the consistent partner, contains the visible row name, and avoids
strict-mode ambiguity against `"<metric> weight"`. The exclusion toggle correctly takes the bare row name as the
row's only control. This is the pre-existing documented rule applied, not a deviation from the AC.

**4. "No visual change" — acceptable, not an AC violation.** The diff adds one attribute to six existing inputs;
no element, class, text node, style or CSS is touched, and the resting render is identical. The hover tooltip is
a real hover-state addition, but it is the same mechanism the number inputs, sliders and reset buttons already
shipped with under the prior ticket, which the human accepted. Flagging for awareness, not for decision.

**5. DRY/SRP — good, and slightly better than before.** The rule is still stated once; `nameToggle` delegates to
`nameControl` rather than re-implementing it. Both `addToggle` sites in all of `src/` are covered, and a future
`SIZING_METRICS` entry inherits its label automatically through `addSizingMetricRow`. Consolidating the
duplicated "two controls share this row" WHY onto the toggle, and the `const name` reused for `setName` +
`nameToggle` in `renderExclusion`, are real drift-risk reductions.

**6. `setDynamicTooltip()` — untouched.** Present at `src/view/VicinityGraphSettingTab.ts:687` with its full WHY
block intact, and its guarding test (`e2e/settingsUxVisual.e2e.ts:499`) passed in my own run.

**7. Preserved functionality.** No behavior-capturing test removed, no anchor point touched, no e2e spec deleted.

## Documentation Updates Needed
None from the reviewer's side. Change-log entry and ticket closure remain TOP_LEVEL_AGENT's, correctly not done
in the implementation commit.
