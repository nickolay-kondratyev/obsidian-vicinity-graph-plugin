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

### Pre-existing red tests (DO NOT "fix" silently)
3 failures on HEAD (`22bd5cb`): `SettingsSpec.test.ts` ×2 and
`forceLayoutSettings.test.ts` ×1, all from `collidePaddingPx` default `20 → 50`
and `max 80 → 100` shipped without updating the baselines. Verified pre-existing
via `git stash -u`. Ticketed at
`docs-internal/tickets/ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md`.
Also stale: the `collidePaddingPx` doc comment in `SettingsSpec.ts` still says
"20" and "[0, 80]". Needs a human decision, not an agent edit.

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
per-row revert icons ("modified-ness" affordance), confirmation on the exclusion
section reset.
