# PRIVATE memory — nid_hatwq2jlkhno5t6awcz0q6t9q_e (sizing bounds invariant)

STATUS: **DONE**. 3 commits on `nid_hatwq2jlkhno5t6awcz0q6t9q_e_2026-07-30T00-53-04PDT`,
tree clean, `npm run check` / `npm test` (1265) / `npm run build` all green. Ticket NOT
closed and NO change_log entry written — both are the top-level agent's job.

Commits: `f3b008e` engine, `5f20f9f` view, `8d0bd6c` docs.

## Plan (all done)
1. [x] RED test in `src/engine/sizingSettings.test.ts` → raise-max rule.
2. [x] `clampSizingSettings` raises `maxPx` to the CLAMPED `minPx`.
3. [x] `NodeSizer.test.ts` inverted-ramp test rewritten (+ moved into the
       hostile-settings describe; the image-floor describe was the wrong home for it).
4. [x] New pure `src/view/numberRowCommit.ts` + colocated test (14 BDD tests).
5. [x] `SettingsRowView.tsx`: `NumberRow` → `NumberField`, uncontrolled + blur-commit,
       refusal slot; KNOWN-LIMIT comment removed.
6. [x] CSS `.vicinity-graph-number-row-block` / `__refusal` in `graph-view.css`.
7. [x] Follow-up ticket `nid_9uzrvqv0k5qgckgdaqtgr41ky_e` (metric WEIGHT input), linked.
8. [x] `CLAUDE.md` + `docs-internal/notes/settings.md` updated.

## Design decisions a clone must not re-derive
- Panel shows ONLY refusals, never the tab's "Stored as N" clamp notice: the panel
  RESEEDS its uncontrolled field from the store on an accepted commit, so the field
  itself tells the truth. The tab keeps the typed text, so it needs the sentence.
  (Also: the reseed remounts the field, which would delete the notice anyway.)
- Reseeding an uncontrolled input = remount ⇒ `key={shown}` on `NumberField`. A REFUSED
  commit never changes `shown`, so a refusal is never remounted away. That is the whole
  reason the component is split in two.
- `interactionIfAccepted` is NOT used by the panel: the panel commits synchronously, so
  `request(value)` (accessor interaction via `useOptimisticValue`) is the same write and
  keeps the optimistic display coherent. That method exists for the tab's DEBOUNCED path.
- `settlesAt` stays per-field. It cannot see a sibling field; cross-field belongs to
  `SizingRowWrite` / `describeSizingRejection` (UI) and `clampSizingSettings` (backstop).
- Enter blurs the input rather than duplicating the commit handler.

## Traps hit (would bite again)
- **NEVER run prettier here.** No prettier config, no prettier dep, repo uses TABS. A
  `prettier --write` reflowed `return unhandledRowControl(row.control)` across lines and
  broke the `settingsRowParity` source scan. Recovery: `git checkout --` the tracked
  files and re-apply edits by hand.
- Two spec-walking tripwires fire on ANY cross-field rule:
  - `src/persistence/settingsSpecPersistence.test.ts` "garbage in X keeps siblings":
    the alternates fixture puts both `minPx`/`maxPx` at the shared range MIN, so
    repairing a garbage `minPx` to its default (40) raises the stored `maxPx` (1).
    Handled with a declared `CROSS_FIELD_REPAIRS` list + 2 new pinning tests in
    `persistedShapes.test.ts`.
  - `src/view/settingsRowAccessors.test.ts` `distinctInBounds` probed at the range FLOOR,
    writing `maxPx = 1` against `minPx = 40`. Now prefers the range CEILING (raising only
    ever moves `maxPx` UP, so a ceiling probe cannot trip the rule from either row).
- `NODE_SIZE_PX_BOUNDS` (`SettingsSpec.ts`) is SHARED by `minPx` and `maxPx`, which is
  why raising to the clamped `minPx` can never leave `maxPx`'s own range.

## Repo landmarks
- `ACCESSOR_OWNED_SYMBOLS` scan (`settingsRowParity.test.ts`) forbids row-rendering
  modules naming `SIZING_RANGES` / `clampSizingNumber` / `parseSizingInput` etc.
- Same file forbids any row LABEL literal in a row-rendering module.
- Nothing under `npm test` renders React — extract logic to a pure module instead.
