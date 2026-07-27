# IMPLEMENTATION_REVIEW__PRIVATE — settings-dependent-row-refresh

Working notes for a clone of me. Reviewed commit `d749265` on `settings-dependent-row-refresh`.

## What I verified myself (not taken on trust)

| Check | Result |
|---|---|
| `npm test` | PASS — 79 files, 1053 tests (`.tmp/review-test.log`) |
| `npm run check` | PASS (`.tmp/review-check.log`) |
| `npm run test:e2e` (full) | see `.tmp/review-e2e.log` |
| Diff scope | only `src/view/VicinityGraphSettingTab.ts`, new `e2e/settingsDependentRows.e2e.ts`, new `_tickets/…disabled.md`, `.ai_out/*` |
| Layering | `src/view/` only. `refreshOpenViews()`, `hide()`, `flushOnBlur()`, `applyReset()`'s `display()` untouched. No `ap_XXX_E` touched. |
| CSS structural selectors | `grep` of `src/view/settings-tab.css` → no child/sibling/`:first`/`:last` selectors that the new slot `<div>` could disturb. Only `:empty` on `.vicinity-graph-settings-error`. |
| e2e structural selectors | `settingsResetReview.e2e.ts:257-258` uses `:scope > .vicinity-graph-settings-section` / `> .vicinity-graph-settings-reset-all` — both still direct children. Nothing counts direct `.setting-item` children of a card, so nesting the patterns row one level deeper is safe. |

## Write-ordering analysis (the thing I was asked to break)

`DebouncedSettingsWrites.drain()` chains onto `this.draining`, and `flush()` cancels the
window then chains. So `settlePendingWrites()` genuinely resolves after any in-flight
drain. Both handlers still `await settlePendingWrites()` before reading the store.

- Exclusion: settle → `applyInteraction` (reads store fresh at 331) → `showExclusionPatterns`
  (reads store fresh at 361). No stale read possible from the debounce direction.
- Sizing: settle → snapshot at 450 → `applySizing`. Snapshot is post-settle, so no
  clobber. Thunks read globals fresh at flush time, so the reverse direction composes.
- Typing that happens DURING the awaits schedules a NEW debounced write; it reads the
  store fresh at flush time and so composes with the toggle's write. No data loss.
  `slot.empty()` destroying the textarea does not drop that write (it lives in the map).

Conclusion: ordering guarantee holds. This was the main risk and it is clean.

## The one real defect I found

`renderExclusion` line 333 re-renders from the CAPTURED `enabled` param, not from the
store. Pre-fix `display()` re-read the store, so double-toggling was self-correcting;
now two overlapping handlers can settle with the checkbox showing ON and the patterns
row absent (or vice versa). Both handlers await real I/O (`flush()` + `saveData`), so
completion order is not guaranteed to match click order. One-line fix:
`this.showExclusionPatterns(patternsSlot, this.store.nodeExclusion().enabled)`.
This is also the house pattern ("globals read FRESH on every write so successive edits
compose" — `writeContext()` doc at :767).

Sizing's `setDisabled(!enabled)` is NOT affected: it runs synchronously before any await,
so last click wins deterministically.

## Test-honesty audit

New spec is honest. Notably:
- `givenTabScrolledAndFocusedElsewhere` asserts `offset > 0` — explicitly guards the
  vacuous-pass case. Good faith.
- `IDENTITY_PROBE` is a JS property, not an attribute — it genuinely cannot survive a
  rebuild. This is a real identity assertion, not a proxy.
- `METRIC_UNDER_TEST` throws on empty table instead of silently skipping.
- No try/catch, no soft assertions, no `if (…) return`.

Two gaps (not dishonesty, coverage):
1. **Nothing asserts the toggles still PERSIST.** A regression that dropped
   `applySizing` / `applyInteraction` from the handlers would leave all 3 new tests green
   (the sizing test only reads `disabled`, which is now set optimistically before the
   write). `controlsRestart.e2e.ts:147` polls a metric WEIGHT, not `enabled`.
2. **Sizing test races the handler.** `setDisabled` is synchronous, so
   `await expect(weight).toBeDisabled()` can resolve while `applySizing` is still in
   flight; `expectTabUndisturbed` then measures a half-finished handler. Today nothing
   after the await touches the tab, so it passes — but as a regression guard against a
   re-introduced `display()` after the await it is weaker than it reads. Both gaps close
   with one `expect.poll(() => harness.readGlobalView() …)` per test, placed BEFORE
   `expectTabUndisturbed`.

The exclusion tests do not have gap 2 (their `toHaveCount` sync point is inside the
handler's tail).

## Ticket `nid_qp56jugz8en8wkgjirwcb269p_e` — legitimate, not a dodge

It is a UX semantics question (hide vs. disable), orthogonal to "stop rebuilding the
tab", and it would change three e2e DOM contracts. The ticket names the exact specs and
sketches the migration. Correct call to defer with `[decide]`. Filed under `_tickets/`
(matches where the `ticket` CLI writes; `docs-internal/tickets/` is the older hand-rolled
dir — pre-existing ambiguity, not this change's problem).

## Things I considered and rejected as findings

- Optimistic `setDisabled` before persistence: on a rejected write the UI is stale — but
  pre-fix `display()` also never ran on rejection, so no regression.
- `let weightInput!: TextComponent`: comment justifies it; `addText`'s builder is
  synchronous. Fine, though an extracted `addSizingMetricRow` would remove the need.
- Extra always-present empty `<div>` in the exclusion card: no CSS or e2e selector
  depends on child position. Inert.
- `renderSizing()` length / SRP: mildly long now, but not new complexity.
