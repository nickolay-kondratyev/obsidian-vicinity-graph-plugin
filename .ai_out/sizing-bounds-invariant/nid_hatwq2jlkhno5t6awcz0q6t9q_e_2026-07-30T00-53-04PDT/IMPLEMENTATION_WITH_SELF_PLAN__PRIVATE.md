# PRIVATE memory — nid_hatwq2jlkhno5t6awcz0q6t9q_e (sizing bounds invariant)

## Goal
Engine backstop (raise maxPx to minPx in `clampSizingSettings`) + panel blur-commit
parity with the settings tab, covering SizingNumberRow (min/max/k) and NodeCapRow.

## Plan (checklist)
1. [ ] FAILING test in `src/engine/sizingSettings.test.ts`: inverted pair ⇒ maxPx raised to minPx.
2. [ ] Implement in `src/engine/constants.ts` `clampSizingSettings`.
3. [ ] Rewrite `src/engine/NodeSizer.test.ts:358` (explicit alignment in ticket Notes 2026-07-29).
4. [ ] New pure `src/view/numberRowCommit.ts` (+ colocated BDD test): blur-commit decision.
5. [ ] `src/view/SettingsRowView.tsx`: NumberRow uncontrolled + blur-commit + refusal slot;
       SizingNumberRow feeds a `SizingRowWrite`; NodeCapRow feeds the unconditional judge.
       Remove the KNOWN-LIMIT comment on NumberRow.
6. [ ] CSS for the refusal line in `src/view/graph-view.css`.
7. [ ] `npm run check` + `npm test` → `.tmp/`.
8. [ ] Follow-up ticket: the metric WEIGHT input in SizingMetricRow is still controlled/per-keystroke.

## Key design decisions (rationale, so a clone does not re-derive)
- Panel shows ONLY refusals, never the tab's "Stored as N" clamp notice: the panel
  RESEEDS its uncontrolled field from the store on an accepted commit, so the field
  itself tells the truth. The tab keeps the typed text, so it needs the sentence.
- Reseeding an uncontrolled input = remount ⇒ `key={shown}` on the input only. A REFUSED
  commit never changes `shown`, so a refusal never gets remounted away.
- `interactionIfAccepted` is NOT used by the panel: the panel commits synchronously, so
  `request(value)` (the accessor's own interaction, via `useOptimisticValue`) is the same
  write and keeps the optimistic display coherent. That method exists for the tab's
  DEBOUNCED path, where the re-check matters.
- No React rendering in `npm test` (repo rule) ⇒ all testable logic in `numberRowCommit.ts`.

## Repo landmarks
- `ACCESSOR_OWNED_SYMBOLS` scan in `src/view/settingsRowParity.test.ts` forbids presenters
  naming `SIZING_RANGES` / `clampSizingNumber` / `parseSizingInput` etc. — go through accessors.
- Same file forbids any row LABEL literal in a row-rendering module.
- `NODE_SIZE_PX_BOUNDS` is SHARED by minPx and maxPx (`SettingsSpec.ts`), so raising maxPx
  to a clamped minPx can never leave maxPx's own range.
