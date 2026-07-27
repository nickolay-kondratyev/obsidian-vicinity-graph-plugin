# IMPLEMENTATION_REVIEW__PUBLIC — settings-dependent-row-refresh

Review of `d749265` (branch `settings-dependent-row-refresh`) against ticket
`nid_9k11zke41l6ze3p7n7suuo4v2_e`.

## Summary

Two `this.display()` calls in `src/view/VicinityGraphSettingTab.ts` are replaced by
row-scoped updates: the exclusion-patterns row now lives in its own slot `<div>` that
`showExclusionPatterns()` fills or empties, and each sizing metric's weight input is
flipped in place via a captured `TextComponent`. `applyReset()`'s full rebuild is
correctly left alone. A new e2e spec (`e2e/settingsDependentRows.e2e.ts`) asserts focus,
`scrollTop`, and DOM-node identity across each flip.

The approach is right, and the "two local fixes, no new abstraction" call is the correct
80/20 read — the two cases really do not share a shape. Comments explain WHY and WHY-NOT
rather than WHAT, and the WHY-NOT for the "render it always, disabled" alternative is
both in the code and in a ticket. This is good work.

**Verified independently, not taken on trust:**

| Check | Result |
|---|---|
| `npm test` | PASS — 79 files / 1053 tests (`.tmp/review-test.log`) |
| `npm run check` | PASS (`.tmp/review-check.log`) |
| `npm run test:e2e` (full, real Obsidian) | **PASS — 83 passed, 54.5s** (`.tmp/review-e2e.log`) — confirms the implementer's claim |

**Write-ordering guarantee: holds.** I traced it specifically because it was the flagged
risk. `DebouncedSettingsWrites.flush()` cancels the window and chains onto `draining`, so
`settlePendingWrites()` resolves after any in-flight drain; both handlers still settle
first, and every subsequent read (`:331`, `:361`, `:450`) is a fresh store read taken
after the settle. Typing that happens *during* the awaits schedules a new thunk that
reads globals fresh at flush time, so it composes rather than clobbers — and
`slot.empty()` destroying the textarea does not drop that pending write, since it lives
in the debouncer's map, not on the DOM node. No stale-value path found.

**Contracts preserved.** `src/view/`-only; `refreshOpenViews()`, `hide()`, `flushOnBlur()`
and `applyReset()`'s `display()` untouched; no `ap_XXX_E` anchor touched; no
behavior-capturing test removed. The new slot `<div>` is safe: `src/view/settings-tab.css`
has no child/sibling/`:first`/`:last` selectors, and the only structural e2e selectors
(`settingsResetReview.e2e.ts:257-258`) address direct children of `.vicinity-graph-settings`,
which are unchanged. `applyReset()` running mid-flip is a non-issue — `display()` rebuilds
the card and re-reads the store.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

### SHOULD-FIX 1 — the exclusion re-render uses the captured param, so a fast double-toggle can leave the row disagreeing with the checkbox
`src/view/VicinityGraphSettingTab.ts:333`

```ts
this.showExclusionPatterns(patternsSlot, enabled);
```

`enabled` is the value captured when *this* handler's click fired. Pre-fix, `display()`
re-read the store, so overlapping handlers were self-correcting: whichever rebuild ran
last painted the store's actual value. Now the last handler to *finish* paints its own
stale param. Both handlers await real I/O (`flush()` then `saveData`), so completion order
is not guaranteed to follow click order — click ON→OFF quickly and you can end up with the
checkbox showing ON and the patterns row absent. That is a small but genuine regression
introduced by this change, and it contradicts the file's own stated invariant ("Globals
read FRESH on every write so successive edits compose", `writeContext()` doc at `:767`).

Fix — one line, and it makes the method's contract honest ("show what the store says"):

```ts
this.showExclusionPatterns(patternsSlot, this.store.nodeExclusion().enabled);
```

Note the sizing side does **not** have this problem: `weightInput.setDisabled(!enabled)`
at `:444` runs synchronously before any await, so last click wins deterministically.

### SHOULD-FIX 2 — the new spec proves the row refreshed, but nothing proves the toggle still persists
`e2e/settingsDependentRows.e2e.ts:180`, `:196`, `:224`

Both handlers were restructured, and the write is now the part of each handler that no
test observes. Delete `await this.applySizing(...)` from the sizing handler and all three
new tests stay green (the input is disabled optimistically, before the write) — as does
the rest of the suite: `controlsRestart.e2e.ts:147` polls a metric *weight*, never
`enabled`. Same for the exclusion `enabled` flag.

Secondary effect on the sizing test: because `setDisabled` is synchronous,
`await expect(weight).toBeDisabled()` can resolve while `applySizing` is still in flight,
so `expectTabUndisturbed()` may be measuring a half-finished handler. It passes today
because nothing after the await touches the tab — but as a guard against someone
re-introducing a `display()` *after* the await, it is weaker than it reads.

One addition fixes both, placed before `expectTabUndisturbed(offset)`:

```ts
await expect
    .poll(async () => (await harness.readGlobalView()).sizing.metrics[METRIC_UNDER_TEST.id]?.enabled)
    .toBe(false);
```

and the analogous `harness.readGlobals()` poll on `nodeExclusion.enabled` in the two
exclusion tests.

## 💡 Suggestions

- **NIT** `src/view/VicinityGraphSettingTab.ts:428-482` — the metric loop body is now ~55
  lines holding a forward-declared `let weightInput!: TextComponent`. Extracting
  `addSizingMetricRow(section, id, label, metric)` would shrink `renderSizing()` back to a
  list of rows and let the weight component be an ordinary local rather than a definite-
  assignment assertion. Not required; the existing comment does justify the assertion.
- **NIT** Behavior change worth knowing about (I judge it an improvement, not a defect):
  toggling a metric no longer re-seeds the weight input's *value* from the store, so a
  rejected in-progress weight edit now survives the flip instead of being silently
  reverted. That is consistent with the ticket's intent — just be aware it is a real
  difference from pre-fix.

## Test honesty

Clean. I looked for the usual tells and found none: no try/catch around assertions, no
soft/conditional assertions, no assertion pinned to observed-but-wrong behavior. Two
things are actively good faith:

- `givenTabScrolledAndFocusedElsewhere()` asserts `offset > 0` *before* using it, so the
  scroll assertion cannot pass by matching nothing on a short tab (`:150`).
- `IDENTITY_PROBE` is a JS **property**, not an attribute — it genuinely cannot survive
  `containerEl.empty()`, so it is a direct node-identity test rather than a proxy (`:67`).
- `METRIC_UNDER_TEST` throws on an empty table instead of silently skipping (`:48`).

The implementer's "no new unit test" section is stated plainly and is correct: vitest runs
in a node environment with no DOM and `node_modules/obsidian` is types-only, and this fix
extracts no new pure logic. Not inventing a jsdom shim to manufacture a green check was
the right call.

## Follow-up ticket assessment

`nid_qp56jugz8en8wkgjirwcb269p_e` (`[decide]` hide vs. render-disabled) is a **legitimate
follow-up, not a scope dodge.** It is a UX-semantics question orthogonal to "stop
rebuilding the tab", it would change three e2e DOM contracts, and the ticket names the
exact specs and sketches the migration. Deferring it with `[decide]` is correct.

## Documentation Updates Needed

None. No CLAUDE.md or architecture-map change is warranted — no new seam, no new layering
rule, and the mechanism is documented where it lives (`showExclusionPatterns`'s doc
comment).

---

## Verdict: **NEEDS ITERATION**

- BLOCKING: **0**
- SHOULD-FIX: **2** (stale `enabled` param at `:333`; persistence not asserted by the new
  spec)
- NIT: 2

Both SHOULD-FIX items are small and mechanical — a one-line change and one `expect.poll`
per test. Nothing about the design needs rework; the architecture, the ordering analysis
and the test honesty are all sound.
