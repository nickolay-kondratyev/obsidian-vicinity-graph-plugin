# DOC_FIXER — private notes

## Judgement calls

- **Struck-through bullets in §C1** rather than deleting them. WHY: the doc is a
  research record; a reader who remembers "we were going to use pin costs" needs to
  see that it was tried and disproved, not find it silently absent. Deleting would
  invite a re-try.
- **Fixed `docs-internal/specs/graph/arrows.md` instead of ticketing it.** The plan
  listed it as a DOC_FIXER-shaped follow-up (§8.2) and the human's instruction was
  "future items to research docs, not tickets" — a stale spec is not a future item,
  it is stale documentation, which is squarely my remit. Verified both claims
  before editing (no `edgeRouting` symbol in `src/engine/`; ticket 02 closed;
  `BOUNDARY_PIN_SPECS` at `src/view/edgeRouting.ts:219`).
- **Did not touch `CLAUDE.md`.** Nothing in it became false: no structure, layering,
  command or convention changed. Adding a "we tried pin costs" line there would be
  volatile detail, which CLAUDE.md explicitly must not carry.
- **Did not touch `README.md`.** No user-visible behaviour or setting changed yet;
  the settings-model update belongs to `edge-routing__06` when the knob actually ships.
- **1.30× vs 1.25×**: every probe number in the record was swept at 1.25. I recorded
  1.30 as the human's decision *for if it is ever built* and kept the 1.25 sweep row
  labelled as the probed knee, rather than silently relabelling measured data as 1.30.
  That distinction is deliberate — do not "tidy" it.
- **Ticket sizing**: description + design + acceptance is ~1 screen each; (a) and (b)
  are explicitly independent commits so an agent can land (a) and stop.

## Phase 2 (Thorg) — nothing to do

- No `src/` changes → no anchor points to create; no `ap_XXX_E` identifiers exist in
  any file I touched (grepped `docs-internal/research/`, `src/view/edgeRouting.ts`).
- No `[title](thorg://notes/${NOTE_ID})` references anywhere in the touched files or
  in `src/view/edgeRouting.ts` (grepped `thorg://`) → no notes to refresh.
- No `[[wiki.links]]` or `![[embeds]]` in the edited markdown → none at risk.

## Verification done

- `git status --short` confirms only docs + the new ticket changed; `src/` clean.
- Line references quoted into the ticket were read directly, not copied from the
  planning doc: `src/view/edgeRouting.ts:71` (buffer const), `:374`
  (`setRoutingParameter`), `src/view/edgeGeometry.ts:45,58`,
  `src/view/edgeRouting.test.ts:109-131` (the two invariant assertions).
- Settings-cost file list verified by grep: `src/engine/constants.ts`
  (`FORCE_LAYOUT_RANGES`, `clampForceLayoutSettings`, `EngineDefaults`),
  `src/engine/SettingsSpec.ts`, `src/persistence/persistedShapes.ts`
  (`PERSISTED_SHAPE_VERSION`), `src/view/VicinityGraphSettingTab.ts`
  (`addForceLayoutSlider` is the row precedent).

## Risk I want on the record

The ticket asks for a 5px buffer sweep. 5px is *below* every visual constant it was
derived from; if the human picks it, arrowheads WILL sometimes overlap neighbours and
the two spec-lock tests must be consciously rewritten. I made that consequence
explicit in three places (description, design, acceptance) precisely so it cannot be
resolved by quietly loosening `src/view/edgeRouting.test.ts:109-131`.
