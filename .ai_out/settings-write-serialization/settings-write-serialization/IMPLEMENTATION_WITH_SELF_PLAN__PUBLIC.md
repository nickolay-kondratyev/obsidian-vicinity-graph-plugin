# IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC — settings write serialization (nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e)

Branch `settings-write-serialization`. Commit `c1315ac`
"fix(settings): serialize settings-tab writes so the last click wins".

## Goal

GIVEN two toggles of the same settings control within one save round-trip, WHEN both handlers
have completed, THEN the persisted value equals the LAST click's, and the on-screen control shows it.

## What changed

| File | Change |
|---|---|
| `src/view/settingsWriteQueue.ts` (new) | `SettingsWriteQueue.enqueue(write)` — one-field promise chain. |
| `src/view/settingsWriteQueue.test.ts` (new) | 4 BDD tests, gated so 2 of them genuinely fail without the queue. |
| `src/view/VicinityGraphSettingTab.ts` | `private readonly writeQueue` + `private enqueueWrite(write)`; every interaction handler routed through it. |

No behavior outside the tab changed; no public API, no persisted shape, no anchors touched.

## Decisions

1. **The queued unit is the WHOLE handler, not `persist()`.** The two toggles read their snapshot
   (`this.store.nodeExclusion()` / `this.store.globalView().sizing`) AFTER `await settlePendingWrites()`,
   so a queue wrapping only the persist would still let two handlers resume off the same pre-write
   snapshot and the later-finishing one clobber the newer value. The queue is therefore entered in the
   DOM handler, before the snapshot read: `settle → snapshot → plan → persist → refresh` is one task.
2. **Chaining idiom** mirrors `PluginDataStore.persist` / `DebouncedSettingsWrites.drain`: the tail is
   stored pre-caught, so one rejected write cannot wedge the chain, while the rejection still reaches
   its own caller through the returned promise.
3. **`applyReset()` is queued too** (both the confirmed and the unconfirmed path). A reset that
   overtook an in-flight click would be partially undone by that click landing after the defaults —
   the exact failure mode this ticket describes, with a bigger blast radius.
4. **Debounced thunks deliberately stay OFF the queue** (they still call `applyInteraction` directly).
   The queue is NOT re-entrant: a queued task calls `settlePendingWrites()` → `debounced.flush()` →
   `drain()` → the thunks; if a thunk enqueued, it would await the tail its own caller holds — a
   deadlock. That is safe because (a) thunks are already serialized by `drain()`, and (b) a thunk's
   read→write is atomic: `applyInteraction` evaluates `writeContext()` and reaches
   `PluginDataStore.persist`'s synchronous `this.data = updated` inside one uninterrupted synchronous
   stretch, so an unqueued drain cannot lose a queued write's update. Documented on `enqueueWrite`.
5. **Force-layout slider read moved inside the task.** It persists the whole `forceLayout` object from
   a snapshot; taken at enqueue time that snapshot could predate a queued-but-unrun write and carry the
   staleness back. Sliders/radios that persist a single field keep their synchronous value capture
   (correct by construction — the value IS the click).
6. **`weightInput.setDisabled()` stays outside the queue** so the row answers the click immediately;
   DOM handlers run in click order, so the newest click paints last. Ditto the browser-owned checkbox
   state — hence store and control agree once the queue drains.
7. **Rejected: re-seeding controls from the store after each write** (per the ticket) — it re-introduces
   the focus-stealing repaint that nid_9k11zke41l6ze3p7n7suuo4v2_e removed.

## Test strategy + the fail-without-fix verification

The tab itself has no unit harness (vitest runs in node; `obsidian` is types-only), so per repo
precedent (`settingsDebounce.ts` + its test) the queue is a pure module tested with hand-written fakes.

A naive double-click test cannot fail — identically shaped await chains resolve FIFO anyway. The tests
therefore use a **gated write**: the FIRST enqueued write is held shut until after the second would have
run unserialized.

- `WHEN a second write is enqueued while the first is still in flight THEN the first has not been overtaken`
- `WHEN the EARLIER write finishes slower THEN the LAST enqueued value is persisted last`
- `WHEN a write rejects THEN the failure reaches ITS caller`
- `WHEN a write rejects THEN a later write still runs`

**Verification performed**: `SettingsWriteQueue.enqueue` was temporarily stubbed to a pass-through
(`return write();`) and the suite re-run. Result: **2 failed | 2 passed** —
`expected [ 'second' ] to deeply equal []` and `expected [ 'second', 'first' ] to deeply equal
[ 'first', 'second' ]`. The real implementation was then restored (byte-identical; `git diff` of the
restore was empty) and all 4 pass. The ordering tests are genuinely capable of failing.

## Verification results (actual)

- `npm test` → **83 test files, 1143 tests, all passed** (exit 0). No pre-existing test regressed.
- `npm run check` → exit 0 (tsc strict for `src/` and `e2e/`).
- `npm run test:e2e` NOT run (release gate, run separately as instructed).

## e2e: not added (reasoning)

An e2e proving this would need a hook to delay one `saveData` inside the Electron build — a new
production-visible test seam for one ordering property that is now fully covered by a pure unit test.
The repo's precedent (every pure-logic fix is fixture-tested; e2e covers rendered DOM/a11y) puts the
80/20 squarely on the unit test. `e2e/settingsDependentRows.e2e.ts` already covers the visible
dependent-row behavior this fix must not break.

## Known gaps / suggested follow-ups (not patched here)

- **Unhandled rejections on `void this.enqueueWrite(...)`** at the slider/radio sites: pre-existing
  shape (`void this.applyInteraction(...)` before), unchanged by this fix. A failed `data.json` write
  from a slider still surfaces only as an unhandled rejection, not as user-visible feedback. Worth a
  ticket if settings-write failure feedback is ever specified.
- **`planSettingsResetConfirmation` reads `writeContext()` synchronously at click time**, i.e. outside
  the queue. That only decides whether to prompt, so the staleness window is cosmetic; left as is.
