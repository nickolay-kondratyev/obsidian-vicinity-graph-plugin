# PRIVATE memory — UX_UI_IMPLEMENTATION_WITH_SELF_PLAN, restore-defaults round

Status at exit: DONE. Working tree dirty (TOP_LEVEL_AGENT commits). No change_log entry written.

## What a future clone must know

### The seam that made this easy
`src/view/settingsWritePlan.ts` already defined `SettingsCommand` (the persistence
call) separately from `SettingsInteraction` (the control event). Resetting is
"produce commands from spec defaults instead of from a control value", so the new
`settingsResetPlan.ts` emits `SettingsCommand[]` directly and the tab's executor
was refactored into `persist(command)` shared by both paths. Do NOT add reset
variants to `SettingsInteraction` — that would force a fake "interaction" per
section and duplicate the merge logic already in `planSettingsWrite`.

### Section → persisted slice mapping (memorize)
| Card | Slice written |
|---|---|
| Depth defaults | `global-depths` (whole `DepthSettings`) |
| Node sizing | `global-view` merging `sizing` |
| Force layout | `global-view` merging `forceLayout` |
| Node exclusion | `node-exclusion` (whole object) |
| Performance | `global-view` merging `nodeCap` |
| ALL | whole-slice writes ×3, `EngineDefaults.viewSettings()` for the view |

`groupByFolder` + `edgeVisibility` live in `globalView` but have NO UI. Only the
`all` scope can restore them — that's why `all` writes whole slices, not merges.

### Gotchas hit
- `renderExclusion()` used an early `return` when exclusion was disabled, which
  would have skipped the reset row. Extracted `addExclusionPatterns()` instead.
- e2e: Obsidian's settings window is itself a `.modal-container`, so the confirm
  dialog needs `.locator(".modal-container").last()` (strict-mode violation
  otherwise). Same trap will bite any future modal e2e.
- `ButtonComponent.then(cb)` (from `BaseComponent`) is the idiomatic way to reach
  `buttonEl` inline for `aria-label`.
- e2e in this sandbox works and is FAST (~3s for the whole spec) — no reason to
  skip it. `npm run test:e2e -- <spec>` passes args through.

### Pre-existing red tests — RESOLVED in iteration 1
The 3 failures were `collidePaddingPx` (default `20 → 50`, `max 80 → 100`) and,
hiding in the same limits assertion, `linkGapPx` (`max 150 → 250`). Human
confirmed the bump was intended → baselines realigned to the spec, doc comments
in `SettingsSpec.ts` fixed, ticket CLOSED. Suite is now fully green (769/769).
Lesson: the "limits baseline" test asserts a whole object, so ONE failing test
can hide TWO stale fields — read the diff, don't patch the first mismatch.

### Design rules applied (from the `obsidian-settings` skill)
- Section reset INSIDE the card's frame, LAST row, demoted (small/muted name +
  top rule) → reads as a footer, not a peer.
- Tab-wide reset OUTSIDE every card, more space above it than between cards.
- Label names the scope; button text stays "Restore defaults" but tooltip +
  `aria-label` carry the scope.
- Red only on the modal's confirm button. Cancel gets initial focus.
- After a reset: `this.display()` so displayed values actually move.

### Deliberately NOT done (scope)
Debounce, `display()` teardown removal, `groupByFolder`/`edgeVisibility` UI,
per-row revert icons ("modified-ness" affordance).

## Iteration 1 (reviewer round) — what a future clone must know

- **Confirmation is data, not a call site.** `SettingsResetScopeSpec.confirmation`
  is `(ctx) => SettingsResetConfirmation | null`, and `requestReset(scope)` in the
  tab is the ONLY reset entry point. Do NOT reintroduce a per-button `if (scope
  === …)`; the whole value is that "which resets confirm" is one lookup. The
  return type is deliberately `ConfirmModalOptions` minus `onConfirm`, so the tab
  is a one-line spread.
- **Context-dependent confirmation matters**: exclusion confirms only when
  `patterns.length > 0`. A dialog over an empty list is friction nobody pays for.
- **`ConfirmModal.items`** exists because the tab HIDES the patterns textarea when
  exclusion is off — the dialog is then the only surface that can show the doomed
  content. Keep the capped-height + scroll, or a long list pushes Cancel off screen.
- **NIT-1 dead end**: `focus({ focusVisible: true })` does NOT typecheck
  (`FocusOptions` has no `focusVisible` in this TS lib). Don't re-try it without a
  cast decision; a `WHY-NOT` comment in `ConfirmModal.ts` records this.
- e2e note: `.modal-container` count is **1** when only the settings window is
  open — that is the assertion for "no dialog appeared". Leaving a dialog open at
  the end of a test breaks the NEXT test's `openSettingsTab()`; press Escape.
