# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (working memory)

Ticket: `nid_x6l6x07rd1d1h4cefqmnyrbec_e` — settings tab: debounce numeric/text writes + validate bounds.
Branch: `settings-debounce-validation`.

## Plan (checklist)

**Goal**: typed settings fields coalesce into one persist+rebuild, reject `maxPx < minPx` visibly,
surface invalid regex lines, pin the existing sizing/decay upper bounds.

1. `src/view/constants.ts` — `SETTINGS_WRITE_DEBOUNCE_MS` named constant (next to `REBUILD_DEBOUNCE_MS`).
2. NEW `src/view/settingsDebounce.ts` — injectable `DebounceScheduler` seam + `WINDOW_DEBOUNCE_SCHEDULER`
   + `DebouncedSettingsWrites` (per-field latest-wins pending map, ONE shared settle timer,
   `schedule/drop/flush`, serialized drain chain mirroring `PluginDataStore.persist`'s `.catch` idiom).
3. NEW `src/view/settingsValidation.ts` — pure: `parseExclusionPatterns` (MOVED out of the tab),
   `invalidExclusionPatterns` → `{lineNumber, pattern, error}[]`, `describeInvalidExclusionPatterns`,
   `describeSizingRejection` (cross-field `maxPx >= minPx`).
4. Wire the tab: every `addText`/`addTextArea` `onChange` → validate (sync, immediate feedback) then
   `debounced.schedule(rowName, thunk)`; invalid → `debounced.drop(rowName)` + error text.
   Thunks read the store FRESH at flush time (preserves the compose invariant). Blur + `hide()` flush.
5. Error slot: `row.descEl.createDiv(".vicinity-graph-settings-error")`, `role="alert"`,
   `aria-invalid` on the input; CSS `:empty { display: none }` (no JS visibility state).
6. Tests: `settingsDebounce.test.ts`, `settingsValidation.test.ts`, extra upper-bound pins in
   `settingsWritePlan.test.ts`.
7. Follow-up tickets for out-of-scope items.

## Key decisions / WHY

- **Debounce key = the row's visible name.** Unique per row already, and it is the same string used as
  the accessible name → no parallel id table to keep in sync.
- **One shared settle timer, per-field pending map.** A per-field timer would be equivalent, but a
  single "user stopped typing" window is simpler and still cannot DROP a field's write: every pending
  field drains, sequentially, latest-value-wins per field.
- **Thunks, not precomputed commands.** `() => this.applySizing({ ...store.globalView().sizing, minPx })`
  defers the store read to flush time, so two fields edited inside one window compose instead of
  clobbering (the `writeContext()` "read fresh" invariant, and the exact bug
  `ticket-controls-optimistic-input-latency.md` describes for the sibling surface).
- **`maxPx < minPx` rejected in the tab, NOT normalized in `clampSizingSettings`.** Deciding whether an
  inverted pair swaps / raises max / lowers min is a user-visible semantics call with no precedent —
  out of scope without human alignment (follow-up ticket filed). The UI simply refuses to persist it and
  says why; the typed text stays in the field.
- **Invalid regex lines are still PERSISTED**, only surfaced. Refusing the write would throw away the
  user's valid lines on the same edit; the engine already tolerates (silently skips) invalid patterns.
- **Sliders left un-debounced** — a prior reviewer explicitly deferred slider debounce as a watch item
  (`.ai_out/settings-ux-improvements/settings/EXPLORATION_PUBLIC.md` §5) and the ticket scopes
  number/text/textarea. Changing drag feel without alignment would be an unrequested behavior change.
- **No Obsidian DOM fake.** Repo has none; the tab stays thin glue and 100% of the new logic is in two
  pure view modules that unit-test with a `FakeDebounceScheduler` (no `vi.useFakeTimers` needed —
  deterministic and simpler than the `GraphViewController.test.ts` window-shim precedent).

## File map

| File | Role |
|------|------|
| `src/view/settingsDebounce.ts` (new) | scheduler seam + `DebouncedSettingsWrites` |
| `src/view/settingsDebounce.test.ts` (new) | coalescing, flush, drop, multi-field, ordering |
| `src/view/settingsValidation.ts` (new) | pure validation + copy |
| `src/view/settingsValidation.test.ts` (new) | sizing rejection + per-line regex results |
| `src/view/VicinityGraphSettingTab.ts` | wiring only (glue stays thin) |
| `src/view/constants.ts` | `SETTINGS_WRITE_DEBOUNCE_MS` |
| `src/view/settings-tab.css` | `.vicinity-graph-settings-error` |
| `src/view/settingsWritePlan.test.ts` | upper-bound pins (AC 3) |

## How to run

```bash
mkdir -p .tmp
npm test  > .tmp/test.log 2>&1
npm run check > .tmp/check.log 2>&1
```

## Dead ends / rejected

- Appending the error element to `Setting.settingEl` — it is a flex row; a third child would need
  overriding Obsidian's flex layout. `descEl` (info column, under the description) needs no override.
- `vi.useFakeTimers` for the debounce tests — works, but the injected `FakeDebounceScheduler` makes the
  seam explicit and the tests shorter.

## Round 1 (IMPLEMENTATION_ITERATION) — review follow-ups

Commit `7207d02`. Disposition table + rationale: `IMPLEMENTATION_ITERATION__PUBLIC.md`.
10 of 12 findings incorporated; CONSIDER 9 (shared settle window) and NIT 12 (untracked ticket file
I was told not to touch) rejected with rationale. No open disagreement with the reviewer.

### What changed structurally

- NEW `src/view/sizingRowWrite.ts` — `SizingRowWrite(field, readSizing, persist)` owns ONE sizing
  row's whole write policy: `storedValue()`, `judge(value) → {message, rejected}`,
  `persistIfAccepted(value)`. This is the key move of the round: three reviewer findings (wrong-field
  rejection, no re-validation at flush time, silent capping) were all "logic living in untestable
  obsidian glue". Now they are one unit-tested object and the tab is `addSizingNumber(section, name,
  field)` — the three `toSizing` lambdas are gone.
- `CROSS_FIELD_ROWS = {minPx, maxPx}` — `depthDecayK` participates in NO cross-field rule. Under the
  old code an inverted stored pair made decay-k **uneditable** (every keystroke dropped).
- `persistIfAccepted` re-takes the verdict at FLUSH time. Confirmed exploitable: `SizingSection.tsx`
  / a second view / a reset can move the globals inside the settle window.
- Cap warning: `Stored as 400 — the allowed range is 40–400.`, computed with the engine's own
  `clampSizingSettings` so the message cannot claim a cap the write path does not perform.
- `PathExclusionMatcher.compileFailure()` is public; `new RegExp(pattern)` now exists once
  (`compilePattern`). `settingsValidation` asks the engine.
- `settlePendingWrites()` = awaited flush that logs instead of leaking a rejection; awaited before
  `applyReset` and before the two toggle handlers that re-`display()`. `display()` doc states it.
- `addFeedbackSlot(row, role)`: `alert` for refusals, `status` for the per-keystroke regex warning.

### Test-strength technique worth reusing

The debounce tests were VACUOUS: `elapse()` followed by `await flush()` drains the same map, so a
dead timer stayed green. Fix: the harness hands out a promise the WRITE THUNK itself resolves
(`written(count)`), plus a 1 s per-test timeout so a dead timer fails fast. **Every fix this round
was sabotage-checked** — break the implementation, watch the new test fail, restore. Cheap
(`cp` the file to `.tmp/`, patch with python, run vitest, `cp` back) and it is the only honest way to
claim a test pins anything.

## State

Round 1 delivered and committed. `npm test` 1053 passed / 79 files; `npm run check` clean.
Working tree clean except the pre-existing untracked `_tickets/nodes-in-groups-…md`.
No `change_log` entry written (TOP_LEVEL_AGENT owns it).
