# UI_IMPLEMENTATION_REVIEW — restore-defaults affordances (branch `settings`, commit 3c86c7f)

**Verdict: READY** (ship), with one MAJOR follow-up worth a human decision before
release and four NITs. No BLOCKING issue.

Reviewed behaviorally against a REAL Obsidian (Electron) via the repo's e2e
harness — not by reading code alone. Scope honored: only the restore-defaults
work was assessed; the CLARIFICATION out-of-scope list was not reported against.

## How it was verified

New review spec: `e2e/settingsResetReview.e2e.ts` — **9/9 pass**
(`npm run test:e2e -- settingsResetReview.e2e.ts`). It goes past the feature spec:

| Test | Proves |
|---|---|
| isolation matrix | dirty ALL five sections, reset each in turn, assert only that section's keys moved and the other four are byte-identical (5 × full cross-check) |
| accessible names | the six reset buttons have six distinct `aria-label`s naming their scope |
| re-render | node cap displayed value moves 42 → 100 after its section reset |
| hidden-pattern wipe | exclusion reset deletes patterns while the textarea is not on screen (see MAJOR-1) |
| modal Escape | Escape closes and is a true no-op; Cancel holds initial focus |
| modal keyboard | Tab → confirm → Enter restores depths, node cap, sizing, force layout and exclusion |
| persistence | reset survives settings-modal close/reopen **and** a full `disablePlugin`/`enablePlugin` reload (comes back off `data.json`) |
| spacing | measured gap before the tab-wide footer > gap between any two cards |
| visual | light + dark + narrow-width screenshots |

Also re-ran the feature spec (`settingsUxVisual.e2e.ts` — 7/7 pass), `npm run check`
(exit 0) and `npm test` (756 pass, exactly the 3 known pre-existing SETTINGS_SPEC /
forceLayout baseline failures — already ticketed, no new failures).

Screenshots (untracked): `.out/settings-reset-review/` —
`settings-resets-{light,dark}-tab.png`, `tab-bottom-{light,dark}.png`,
`card-forcelayout-{light,dark}.png`, `card-exclusion-{light,dark}.png`,
`confirm-modal-focus.png`, `settings-resets-narrow.png`,
`exclusion-disabled-with-hidden-patterns.png`.

## What is correct

- **Isolation is real.** Every section reset writes only its own slice; the
  merge-over-current-view approach (`src/view/settingsResetPlan.ts:56,63,75`)
  keeps sibling sections untouched. Verified in the running app, all five ways.
- **Scope is legible from the screen alone.** Each row is named
  `Restore <section> defaults` with a one-sentence description of exactly what
  changes; the button's accessible name carries the full scope, so six identical
  "Restore defaults" button texts are still distinguishable to a screen reader
  (`VicinityGraphSettingTab.ts:96-104`).
- **Placement and altitude are consistent.** All five reset rows are the last row
  *inside* their card, demoted (small, muted name, rule above); the tab-wide one
  sits outside every frame with measurably more space above it. Native-quiet look
  in both themes; theme variables only (`settings-tab.css`).
- **Confirmation is correct.** Modal title restates the scope, body restates the
  blast radius plus "This cannot be undone", confirm button restates the action
  (never "OK"), warning red is on the modal's confirm only — not on the button
  that opens it. Cancel takes initial focus, Escape and Cancel are both true
  no-ops (proven against the store, not just the DOM).
- **Single source of truth.** Zero default literals in the UI layer; everything
  projects from `SETTINGS_SPEC` / `EngineDefaults`, including the node-cap value
  interpolated into the performance description.
- **Persistence.** Survives tab reopen and a plugin reload.
- No layout breakage at a squeezed (320px) pane: the only rows that overflow are
  the pre-existing two-control sizing-metric rows, unchanged by this work.

## Findings

### MAJOR

**MAJOR-1 — The node-exclusion reset destroys user-authored content with no
confirmation, and can do it to content that is not on screen.**
`src/view/settingsResetPlan.ts:66-69`, applied unconfirmed via
`VicinityGraphSettingTab.ts:190`.

Four of the five section resets restore numeric knobs — cheap to redo, so
"instant, no confirm" is the right call. The fifth deletes hand-written regexes,
which are *content*, not a setting value: there is no undo and no way to recover
them. Worse, when *Exclude notes from the graph* is toggled off the tab hides the
patterns textarea while still keeping the stored patterns (by design, so
re-enabling restores them) — so `Restore node exclusion defaults` in that state
wipes a list the user cannot see and may not remember having. Proven by
`e2e/settingsResetReview.e2e.ts` test 4 + `exclusion-disabled-with-hidden-patterns.png`.

The description does say "deletes every exclusion pattern", which is honest — this
is a friction-scales-with-blast-radius call, not a lying-label call. Recommended
fix (cheap, `ConfirmModal` is already generic): route this one scope through the
confirmation when `patterns.length > 0`. Flagging for the human because
TOP_LEVEL decision #2 ("per-section resets are unconfirmed") was made before this
asymmetry was visible.

### NIT

**NIT-1 — Cancel's initial focus is not *visible*.** `ConfirmModal.ts:41` calls
`buttonEl.focus()`; Chromium does not set `:focus-visible` for programmatic focus,
so a keyboard user sees no focus ring and the first Tab appears to land on the
destructive button. Measured: initial `focusVisible=false`, after one Tab
`focusVisible=true` on "Restore all defaults". The *safety* intent holds (Enter on
open still cancels); only the indicator is missing. `focus({ focusVisible: true })`
or a `.focus-visible`-forcing class would fix it.

**NIT-2 — The confirm modal is not fully focus-trapped.** Tabbing repeatedly
cycles Cancel ⇄ confirm but on roughly the fourth Tab focus escapes to the file
explorer behind the settings window, then returns. This looks like stock Obsidian
`Modal` behavior rather than something `ConfirmModal` introduces (it adds no
tabindex of its own), so it is recorded as an observation, not a defect to fix
here.

**NIT-3 — Title says "all Vicinity Graph settings", body says "in this tab".**
`settingsResetPlan.ts:79-81`. Per-note depth overrides and pins are NOT reset (a
good thing), but nothing says so — while the sibling depth-defaults description
does explicitly reassure "Per-note depth overrides are kept." One clause added to
the `all` description would close the gap. (It also resets `groupByFolder` /
`edgeVisibility`, which have no UI anywhere, so that is invisible and harmless.)

**NIT-4 — The Force layout card's `Advanced spacing` disclosure is no longer the
last thing in its section**, since the reset footer now follows it
(`VicinityGraphSettingTab.ts:152-157`). The skill's tail-disclosure carve-out asks
for "last in its section"; in the rendered result the reset row reads clearly as a
demoted card footer rather than a peer (see `card-forcelayout-light.png`), so this
is acceptable as shipped — noted only so it is a decision, not an accident.

## Left in the tree

- `e2e/settingsResetReview.e2e.ts` (new, passing) — kept as the behavior-capturing
  regression net for reset isolation, modal keyboard operability and persistence.
- No implementation code was modified (`src/` untouched by this review).
