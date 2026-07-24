# UI_IMPLEMENTATION_WITH_SELF_PLAN — restore-defaults affordances (branch `settings`)

## Goal

Give every settings-tab section its own restore-defaults affordance with an
unambiguous, stated scope, plus one confirmed tab-wide restore at the bottom.
Nothing else (the CLARIFICATION out-of-scope list was honored — no debounce, no
`display()` teardown work, no `groupByFolder`/`edgeVisibility` exposure).

## Design decisions

1. **One mechanism, six scopes.** New pure module `src/view/settingsResetPlan.ts`:
   `planSettingsReset(scope, ctx) → readonly SettingsCommand[]`. It reuses the
   EXISTING `SettingsCommand` contract, so a reset is persisted by the same
   `saveGlobalDepths` / `saveGlobalView` / `saveNodeExclusion` executor a slider
   drag uses. No copies of "reset this key-set" logic anywhere.
2. **Copy lives next to the key-set it clears.** `SETTINGS_RESET_SCOPES` holds
   `{ label, description, plan }` per scope, so the stated blast radius and the
   keys actually written cannot drift. The `performance` description interpolates
   the node-cap default from `SETTINGS_SPEC` rather than typing `100`.
3. **Defaults come only from `EngineDefaults` / `SETTINGS_SPEC`.** Zero literals.
   The `all` scope deliberately writes WHOLE slices (`EngineDefaults.viewSettings()`)
   rather than merging, so it also restores the two persisted view fields the tab
   has no control for (`groupByFolder`, `edgeVisibility`); section scopes merge
   over the current view so sibling sections stay byte-identical.
4. **Placement per the `obsidian-settings` skill.** Each section reset is the LAST
   row INSIDE its card (`.vicinity-graph-settings-reset`), demoted (small, muted
   name, separator rule above) so it reads as the card's footer, not as a peer
   control. The tab-wide reset lives OUTSIDE every card, below all of them, with
   more space above it than between any two cards.
5. **Friction scales with blast radius.** Section resets apply instantly (and
   re-render the tab so every control's shown value moves). The tab-wide reset
   opens a confirmation (`src/view/ConfirmModal.ts`, generic + reusable): Cancel
   holds initial focus, the red/warning treatment is on the modal's confirm button
   only — never on the button that opens it.
6. **Labels name the scope** ("Restore node sizing defaults"), the button text
   stays "Restore defaults" (and the accessible name/tooltip carries the full
   scope label, since six identical button texts would otherwise be ambiguous to a
   screen-reader user).
7. Existing in-graph React force-layout reset left untouched (CLARIFICATION #4);
   its wording already matches.

## Files changed

- **NEW** `src/view/settingsResetPlan.ts` — scope catalogue + pure planner +
  compile-time assertion that every scope is placed (section vs tab-wide).
- **NEW** `src/view/settingsResetPlan.test.ts` — 19 BDD tests.
- **NEW** `src/view/ConfirmModal.ts` — generic destructive-action confirmation.
- `src/view/VicinityGraphSettingTab.ts` — `addSectionReset()` called by all five
  `renderX()`; `renderRestoreAll()`; the old bespoke force-layout restore button
  deleted in favour of the shared one; write path refactored into
  `writeContext()` + `persist(command)` shared by `applyInteraction` and the new
  `applyReset`; `renderExclusion()`'s early `return` replaced by
  `addExclusionPatterns()` so the reset row is always last in that card.
- `src/view/settings-tab.css` — `.vicinity-graph-settings-reset` (footer demotion)
  and `.vicinity-graph-settings-reset-all` (tab footer). Theme vars only.
- `e2e/settingsUxVisual.e2e.ts` — 3 new real-Obsidian tests (see below).
- `README.md` — one bullet documenting both affordances.
- **NEW** `docs-internal/tickets/ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md`
  (pre-existing failure found, not caused — see below).

## Tests

- `npm run check` — **PASS** (exit 0).
- `npm test` — 756 passed, **3 failed**, and all 3 failures are **PRE-EXISTING on
  HEAD**: verified by `git stash -u && npx vitest run …` reproducing them
  identically on `22bd5cb`. They are `SettingsSpec.test.ts` (defaults + limits
  baselines) and `forceLayoutSettings.test.ts`, all on `collidePaddingPx`
  (`20 → 50`, `max 80 → 100`) changed by commit `22bd5cb` without updating the
  baselines. Not touched here (behavior-capturing baselines need human alignment);
  ticketed instead.
- New unit tests (red-first: verified failing with "Cannot find module
  './settingsResetPlan'" before the module existed) cover: each section scope
  restores only its own keys and preserves every other field; the depth/exclusion
  scopes emit no view write at all; the `all` scope restores EVERY view key
  including the two with no UI; `all` is idempotent; and the scope catalogue is
  complete with no bare "Restore defaults" label.
- e2e (`npm run test:e2e -- settingsUxVisual.e2e.ts`) — **7/7 pass** against real
  Obsidian: five scoped reset rows with the exact expected names, a section reset
  that resets node cap while leaving tuned depths alone, and restore-all whose
  Cancel is a true no-op and whose confirm resets everything.
- Screenshots (light + dark) in `.out/settings-ux/`:
  `settings-tab-resets-light.png`, `settings-tab-restore-all-confirm.png`,
  `settings-tab-cards-{light,dark}.png`.

## Reviewer notes / known limitations

- A section reset re-renders the whole tab (`this.display()`) — same pre-existing
  pattern the toggles already use; the deferred teardown work is out of scope.
- Node-exclusion's reset deletes the user's patterns with no confirmation (per
  TOP_LEVEL decision #2: per-section resets are unconfirmed). Its description says
  so explicitly ("Turns exclusion off and deletes every exclusion pattern"). If
  the human would rather confirm that one, `ConfirmModal` is already generic.
- Per-row revert icons (modified-ness affordance from the skill) were NOT added —
  bigger surface than this round's scope; candidate follow-up.
- Not committed, per instructions. `.tmp/` and `.out/` artifacts are untracked.

---

# Iteration 1 — reviewer findings + the two human decisions

`npm test` **769 passed / 0 failed** (was 756 + 3 pre-existing). `npm run check`
exit 0. e2e: `settingsResetReview.e2e.ts` **11/11**, `settingsUxVisual.e2e.ts`
**7/7**, both against real Obsidian.

## Human decision 1 — the `collidePaddingPx` bump was INTENDED

`default 50, max 100` is the shipped truth, so the baselines were realigned to
the spec (not the reverse). `linkGapPx max 150 → 250` from the same commit was
equally stale and is fixed in the same breath.

- `src/engine/SettingsSpec.test.ts` — defaults + limits baselines.
- `src/engine/forceLayoutSettings.test.ts` — value, plus the docblock/describe
  that wrongly claimed the WHOLE baseline was ticket-03's.
- `src/engine/SettingsSpec.ts` — both stale doc comments now document the shipped
  values, and the `collidePaddingPx` one names `22bd5cb` as the deliberate move.
- `docs-internal/tickets/ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md`
  → **CLOSED** with a Resolution section.

## Human decision 2 — MAJOR-1 ACCEPTED: node-exclusion reset now confirms

**Design:** confirmation is not a call-site decision. `SettingsResetScopeSpec`
gained `confirmation?: (ctx) => SettingsResetConfirmation | null`, and the tab
routes EVERY reset button through one `requestReset(scope)` → confirm-or-apply.
So "which resets are destructive, and what do they say" is answerable in exactly
one file, right next to the key-set each one clears. The tab-wide reset moved
onto the same seam (its bespoke inline modal copy is gone).

- **Confirms only when there is something to destroy**: `patterns.length > 0`.
  An empty pattern list resets instantly — a dialog with nothing to lose is
  friction without a payer.
- **Shows what is being destroyed even when it is off screen**: the confirmation
  carries `items` = the patterns verbatim, and `ConfirmModal` renders them as a
  monospace, capped-height, scrollable inset list. This is the whole point of the
  finding — with exclusion toggled off the tab hides the textarea, so the dialog
  is the ONLY surface that can show the content. Screenshot:
  `.out/settings-reset-review/exclusion-confirm-hidden-patterns.png`.
- **Confirm button restates the deletion** — "Delete patterns and restore
  defaults", not the generic "Restore all defaults".
- Other section resets stay confirmation-free (verified by a test that asserts
  *no* non-exclusion section scope produces a confirmation).

## Disposition of every reviewer finding

| Finding | Disposition |
|---|---|
| **MAJOR-1** exclusion reset destroys unconfirmed, possibly-hidden content | **ACCEPTED, fixed** — see above. The reviewer's e2e test that captured the flaw was rewritten into three tests that capture the fix (shows hidden patterns / Cancel keeps them / no-patterns needs no dialog). |
| **NIT-1** Cancel's initial focus is not `:focus-visible` | **REJECTED (not trivial).** `focus({ focusVisible: true })` was tried and fails `npm run check` — `focusVisible` is not in TS's `FocusOptions`, so it needs a cast plus unverified Electron support; the CSS alternative fights every theme's focus ring. The safety property is unaffected (Enter on open still cancels); a `WHY-NOT` comment now records the attempt at `ConfirmModal.ts`. |
| **NIT-2** modal is not fully focus-trapped | **REJECTED (not ours).** Stock Obsidian `Modal` behavior — `ConfirmModal` adds no tabindex; fixing it means fighting the framework's focus manager for a cosmetic escape that returns on its own. |
| **NIT-3** "all Vicinity Graph settings" vs "in this tab", silent about survivors | **ACCEPTED, fixed.** The `all` description is now "Resets every Vicinity Graph setting — … — to its shipped default. Per-note depth overrides and pinned notes are kept.", pinned by two tests (must contain the survivor sentence, must NOT say "this tab"). README bullet realigned too. |
| **NIT-4** `Advanced spacing` disclosure is no longer last in its card | **REJECTED (accepted as shipped).** The reviewer's own screenshot confirms the reset row reads as a demoted card footer, not a peer; moving the disclosure below it would put a collapsible *after* the card's closing affordance, which is worse. Recorded as a decision. |

## Files changed this iteration

- `src/view/settingsResetPlan.ts` — `SettingsResetConfirmation`, per-scope
  `confirmation`, `planSettingsResetConfirmation()`, reworded `all` copy.
- `src/view/ConfirmModal.ts` — optional `items` list + `renderItems()`.
- `src/view/VicinityGraphSettingTab.ts` — `requestReset()` as the single entry
  point; `renderRestoreAll()` no longer builds modal copy.
- `src/view/settings-tab.css` — `.vicinity-graph-confirm-items`.
- `src/view/settingsResetPlan.test.ts` — +10 tests (red-first: all 10 failed with
  `planSettingsResetConfirmation is not a function` / the old `all` copy).
- `src/engine/{SettingsSpec.ts,SettingsSpec.test.ts,forceLayoutSettings.test.ts}`.
- `e2e/settingsResetReview.e2e.ts` — exclusion steps updated, +2 tests.
- `README.md`, the closed ticket.

No `change_log` entry, no commit — left for TOP_LEVEL_AGENT.
