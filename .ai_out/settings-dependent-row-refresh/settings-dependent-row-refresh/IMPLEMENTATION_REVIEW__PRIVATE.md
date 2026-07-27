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

---

# Round 2 (fresh instance) — `b1c13e2` + `8d5142e`

## Re-run myself, not taken on trust

| Command | Real result | Log |
|---|---|---|
| `npm run check` | exit 0 | `.tmp/r2-check.log` |
| `npm test` | 79 files / **1053 passed** | `.tmp/r2-test.log` |
| `npm run test:e2e` (full, real Obsidian) | **83 passed, 1 skipped (55.5s)**, exit 0 | `.tmp/r2-e2e.log` |

The `1 skipped` is **not** new and not a regression: `e2e/externalVault.e2e.ts:30`
`test.skip(vaultDir === undefined ...)` — env-gated on `VICINITY_E2E_VAULT`. Round 1's log
just did not surface the line. Grep for `test.skip|\.skip\(|test.fail` across `e2e/` and
`src/` returns only that one plus a pre-existing wasm `ctx.skip` in
`src/view/edgeRouting.test.ts:356`. Nothing was skipped to make this branch green.

## The implementer's pushback — both claims are CORRECT. I was wrong twice.

**(a) Sizing has no paint hazard, and reading the store there would be a bug.**
Verified in `src/view/VicinityGraphSettingTab.ts` `addSizingMetricRow`:
`weightInput.setDisabled(!enabled)` is the FIRST statement of the handler, before
`await this.settlePendingWrites()`. At that instant the store has not been told about
`enabled` yet, so `this.store.globalView()` would return the PREVIOUS value — reading the
store there paints backwards. Exclusion paints *after* its own write, so there the store
is the freshest truth. Their rule — "paint from the freshest truth at paint time" — is the
correct generalization; "always read the store" was my over-generalization. The asymmetry
is now named in both comments so nobody "fixes" it.

**(b) The `let weightInput!: TextComponent` NIT premise was wrong.** Verified: the fluent
chain builds `addToggle` before `addText`, and the toggle's `onChange` closure must
reference the weight component. Making it an ordinary local would require swapping the
builder order, which swaps the two controls' DOM order inside the row. So the definite-
assignment assertion is structural, not a symptom of the long method. The extraction was
still worth doing (consistency with `addSizingNumber` / `addExclusionPatterns`), and they
applied it while correcting my stated reason. That is the right way to take a NIT.

## `expect.poll` non-vacuity — sanity-checked independently

Each test SEEDS the opposite value before flipping (`saveNodeExclusion({enabled:true})`
then poll `false`; `{enabled:false}` then poll `true`; `saveGlobalView(... enabled:true)`
then poll `false`), followed by `redisplay()`. With the handler's write deleted the store
retains the seeded value and the poll times out. Genuinely non-vacuous by construction —
no need to take the sabotage run on faith.

**"1 failed / 2 passed" for the sizing sabotage is exactly right**, not a vacuous test:
tests 1–2 are the two *exclusion* tests and do not touch `applySizing`, so they must stay
green; test 3 is the only sizing test and it failed. If a sizing test had been vacuous the
symptom would have been 0 failed. Also note `toBeDisabled()` still passes with the write
deleted (setDisabled is unconditional) — so the poll is precisely the assertion that
catches it.

## `addSizingMetricRow` extraction — pure move

Diffed body-by-body: identical statements, only `metric` → `seed` param and the added
contrast comment. No behavior delta, no DOM order change, no selector/aria-label change
(`${label} weight`, `nameControl`, `applyRange`, `flushOnBlur`, debounce key all
identical). No `ap_XXX_E` anchor exists in this file. No test file added/removed/modified
outside the new spec (`git diff 70b4133..HEAD -- '*test*'` is empty).

## Double-toggle race — their honesty position is sound, and stronger than they claim

They say no deterministic test exists and they did not fake one. I pushed on whether one
COULD be written: you would need a delay seam in the persist path (or a browser-side
monkeypatch of the store's save) to force handler A to finish after handler B. But even
with such a seam, the stale-param divergence is hard to *force*, because in each handler
the paint is the statement immediately after the write's await — paint order follows write
order. So the pre-fix stale param would usually still agree with the store. That means the
fix is justified on **contract** grounds (unrepresentable stale value, one snapshot for
both flags), which is exactly what they claimed, and my round-1 "genuine regression"
framing was stronger than the evidence supports. The residual checkbox-vs-store divergence
IS real and IS the unserialized-writes ticket.

## Both tickets — legitimate

- `nid_qp56jugz8en8wkgjirwcb269p_e` `[decide]` — unchanged assessment from round 1.
- `nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e` — read it. Correctly scoped as PRE-EXISTING and
  tab-wide, names the mechanism, gives the 80/20 design (one promise chain), records the
  rejected alternative, has GIVEN/WHEN/THEN acceptance criteria, and explicitly warns
  against writing a double-click test that cannot fail. That last line is the opposite of
  a scope dodge.

## Verdict: READY TO MERGE. 0 blocking, 0 should-fix. No new findings.
