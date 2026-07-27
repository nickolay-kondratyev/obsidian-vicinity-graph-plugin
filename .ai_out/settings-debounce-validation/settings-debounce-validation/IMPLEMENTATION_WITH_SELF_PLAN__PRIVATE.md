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

## State

Implemented + committed; `npm test` and `npm run check` green (see PUBLIC).
