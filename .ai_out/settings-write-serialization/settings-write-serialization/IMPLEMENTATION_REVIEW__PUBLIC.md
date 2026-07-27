# IMPLEMENTATION_REVIEW__PUBLIC — settings write serialization (nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e)

Reviewed commits `c1315ac` (fix) + `786d96d` (artifacts) on `settings-write-serialization`.

## Verdict: READY — no blocking issues.

Every implementer claim I could check independently held up. Nothing removed, nothing faked.

## Summary of the change

`src/view/settingsWriteQueue.ts` (new, 38 lines, pure — no `obsidian`/`react` imports) holds a single
pre-caught promise tail; `VicinityGraphSettingTab` gained `writeQueue` + a one-line `enqueueWrite()`
and routes every interaction handler through it as a WHOLE task
(`settle → snapshot → plan → persist → refresh`). Debounced typed-field thunks stay off the queue.

## Verification I ran myself (not the implementer's numbers)

| Check | Result |
|---|---|
| `npm test` | **83 files, 1143 tests, 1143 passed**, exit 0 |
| `npm run check` | exit 0 (`tsc -noEmit` for `src/` and `e2e/`) |
| Fail-without-fix (I stubbed `enqueue` → `return write();` myself) | **2 failed \| 2 passed** — `expected [ 'second' ] to deeply equal []` and `expected [ 'second', 'first' ] to deeply equal [ 'first', 'second' ]`. Restored; `git status` clean. |
| Anchors / behavior tests removed | none (`git diff main...HEAD` has no deleted files, no removed `ap_*_E`, no removed `it(`/`describe(`) |

## 1. Acceptance criterion — met

Traced every write path in the tab. All USER-INTERACTION handlers are queued, and in each case the
store read is genuinely **inside** the serialized region:

- exclusion enable (L367-388) — `enqueueWrite` wraps `settlePendingWrites → store.nodeExclusion() →
  applyInteraction → showExclusionPatterns`. The snapshot read is after the await and inside the task. ✅
- sizing metric enable (L522-544) — `weightInput.setDisabled()` fires synchronously (correct: DOM
  handlers run in click order, so the newest click paints last), then `enqueueWrite` wraps
  `settlePendingWrites → store.globalView().sizing → applySizing`. ✅
- depth sliders (L728), outline-depth slider (L600), node-preview radios (L645), force-layout sliders
  (L809, read correctly moved *inside* the task since it persists the whole object), both reset paths
  (L288 / L295). ✅

Left off the queue, correctly: `hide()`'s settle, `flushOnBlur`'s settle, and the debounced thunks.
No handler still reads state outside the queue that would carry staleness back.

On-screen agreement: the checkbox is browser-owned and shows the last click; the store now ends on the
last-enqueued (= last-clicked) task. `showExclusionPatterns()` re-reads the store, so the dependent row
is derived, not captured. Criterion satisfied.

## 2. The test is honest and can fail

I reproduced the fail-without-fix independently (above). It is not FIFO luck: the gated write makes the
FIRST task finish LAST, which is precisely the interleaving the queue exists to prevent — with a
pass-through `enqueue` the order flips to `['second','first']`. Failure coverage is present on both
sides of the contract (rejection reaches its own caller; a rejection does not wedge the chain).

Minor: test 1 (`… the first has not been overtaken`) is weaker than test 2 — it asserts synchronously,
so any implementation deferring by a microtask passes it regardless of ordering. It does still fail
against the stub, and test 2 carries the real weight. Not worth changing.

## 3. The debounced-thunks deadlock claim — TRUE, and the residual race is benign

Verified by reading the call graph: a queued task → `settlePendingWrites()` → `debounced.flush()` →
`drain()` → runs the thunks. A thunk that enqueued would `.then` off `this.tail`, which is the promise
of the task currently awaiting it. Real deadlock. Keeping thunks off the queue is correct, not
rationalization.

The residual interleaving — a debounce **timer** firing mid-flight of a queued task — I checked
concretely and it cannot lose an update, because every write path's read→apply is one uninterrupted
synchronous stretch: `writeContext()` / `store.globalView().sizing` / `SizingRowWrite.prospective()` →
`store.saveGlobalX()` → `PluginDataStore.persist`'s `this.data = updated` runs with **no intervening
await**. Disk ordering is then owned by `PluginDataStore.writeChain`. So a drained thunk and a queued
task can only interleave at whole-write granularity, and last-writer-wins there is the user's own
newest intent. The implementer's stated reasoning matches what the code actually does.

## 4. `applyReset()` / `display()` — queued correctly, one narrow known gap

`applyReset` is queued on both the confirmed and unconfirmed path, drains the debounce first, plans all
commands from one snapshot, then `display()`. No re-entrancy hazard: `display()` runs inside the task
and reads the store synchronously.

Known gap (pre-existing in kind, NOT a regression, non-blocking): if a control click is enqueued
*behind* a reset, the reset's `display()` rebuilds the controls first and the later write then persists
a value the freshly-seeded control does not show — and, for the exclusion toggle, paints into a now
detached `patternsSlot`. Harmless (no crash, no data loss) and inherent to "the user clicked a control
that is about to be destroyed". Worth a follow-up ticket only if reset-vs-click races are ever specified.

## 5. Code quality

Layering respected (`settingsWriteQueue.ts` is pure; `src/view/` may import obsidian). Strict TS clean.
Naming honest. Comments explain WHY and WHY-NOT, including the non-obvious "why the THUNK covers the
whole handler" and "why NOT re-entrant" — exactly the knowledge that would otherwise be re-derived.
No dead code, no over-engineering. 38 lines for the whole mechanism is the right 80/20.

## 6. e2e skipped — right call

Proving this end-to-end needs a production-visible seam to delay one `saveData` inside the Electron
build: a permanent test hook for one ordering property already covered by a pure unit test. That trade
is clearly wrong-way-round. `e2e/settingsDependentRows.e2e.ts` still guards the visible behavior this
must not break. Agreed with the decision.

## Non-blocking suggestions

1. **DRY (worth a ticket):** the "pre-caught serial promise chain, rejection reaches its own caller"
   contract now exists in **three** places — `PluginDataStore.writeChain`, `DebouncedSettingsWrites.draining`,
   `SettingsWriteQueue.tail`. That is a subtle concurrency invariant re-stated three times, and each copy
   has its own comment saying the same thing (the CLAUDE.md "same WHY comment twice" heuristic fires here).
   A tiny `SerialPromiseChain` in `src/shared/` used by all three would remove the duplication. Low risk,
   but out of scope for this fix — file a ticket rather than doing it now.
2. **`enqueueWrite()` is a pure delegation** to `writeQueue.enqueue`. It earns its keep as the doc anchor
   for the not-re-entrant rule; leaving it is fine.
3. **Unhandled rejections on `void this.enqueueWrite(...)`** — pre-existing shape, unchanged, already
   flagged by the implementer. Only worth a ticket if settings-write failure feedback is ever specified.

## Remaining work before merge

- `change_log` entry and ticket closure for `nid_7ni3rjx3bx6w2bdfvpp7wj0xb_e` (the repo's pattern is a
  separate final `chore:` commit — see `ed94a8c`). Not yet present on this branch.
- Optional: file the DRY follow-up ticket from suggestion 1.

## Documentation updates needed

None. No CLAUDE.md / architecture-map change is warranted — the queue is an internal view-layer detail
and both the module doc and `enqueueWrite`'s doc already carry the stable knowledge.
