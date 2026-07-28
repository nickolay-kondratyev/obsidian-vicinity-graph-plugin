# DOC_FIXER — private notes

## Judgement calls

1. **Where D2 goes.** Three candidates: `SettingsSpec.ts` (the default that changed),
   `persistedShapes.ts:219` (the fallback that only fires on an ABSENT key), README. Picked
   `SettingsSpec.ts` only. `persistedShapes` is generic across every field — a per-field migration
   note there would be knowledge duplication in the wrong place. README is user-facing and this is a
   maintainer concern about a pre-release install base of one. One sentence, one home.

2. **README gloss vs rename.** The human explicitly declined a rename, so I only made the prose
   non-misleading. The prior text bundled three sliders and glossed only the last; a reader could
   reasonably read "Group member spacing" as group-to-group. "nothing else" is the cheapest
   disambiguation that does not restate the JSDoc.

3. **Artifacts are a historical record.** I did not delete the questions — I re-headed the sections
   and inlined the verdicts. Deleting would lose the reasoning that produced the decision; leaving
   "still open and still required before merge" would be actively false. Kept question 3 in each file
   open, since the human decided two of three.

4. **Did not soften the reviewer's "one doc tension" note** (constants.ts para 1 "only a seed" vs
   para 3 "changing it blew a budget") — the current JSDoc already reconciles it with "The seed still
   MATTERS though". No manufactured edit.

## Stale item found, NOT fixed (out of my lane)

`_change_log/2026-07-28_00-47-39Z.md:17` — "no change to ... settings (the single `elkNodeSpacingPx`
knob still drives both passes)". Accurate for the commit it describes (`4cd7366`), stale relative to
HEAD after `67c6c2f` split the passes. `_change_log/` is TOP_LEVEL_AGENT's; surfaced in the final
message instead.

## Verification

- `npm run check` → 0 (`.tmp/doc-check.log`)
- `npm test` → 0, 84 files / 1153 passed + 1 expected fail (`.tmp/doc-test.log`)
- Grep confirms no remaining `awaiting sign-off` / `#QUESTION_FOR_HUMAN` framing about D1/D2 in `src/`
  or the PUBLIC artifacts.
- No `ap_XXX_E` anchors exist in the touched files; none removed.
