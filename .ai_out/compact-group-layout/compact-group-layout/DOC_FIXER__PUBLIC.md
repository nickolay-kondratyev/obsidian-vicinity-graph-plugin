# DOC_FIXER — compact-group-layout

Docs/comments only. No production behaviour, no test assertions touched.
`npm run check` exit 0; `npm test` 84 files, 1153 passed + 1 expected fail (the pre-existing
landscape-stranding `it.fails`, untouched).

## Human decisions recorded

**D1 — "Keep it: the slider is intra-group only."**
`src/view/constants.ts` — `ELK_ROOT_SEED_NODE_SPACING_PX` JSDoc: the "WHY IT IS NOT THE USER KNOB"
paragraph now reads as a DECIDED trade-off ("DECIDED — do not re-couple them", "accepted with eyes
open") instead of "awaiting the human's sign-off before merge". The consequence is kept verbatim and
truthful: a user with a saved non-default value no longer feeds this seed, and nothing in the UI
explains that.

**D2 — "Leave migration alone."**
`src/engine/SettingsSpec.ts` — one WHY-NOT paragraph on `elkNodeSpacingPx`: pre-release, a saved
value is a user choice we do not overwrite, existing installs (including the maintainer's own, which
matters when re-testing layout) keep 40 until *Restore force layout defaults*. Stated once, at the
default that changed — the place a maintainer looks. **No migration code added.**

## Also touched

- `README.md` (settings model) — glossed **Group member spacing** as "the gap between notes *inside*
  one folder group, nothing else". The old line left the reader free to assume it spaced groups apart
  too, which is now false. Slider NOT renamed, per D1.
- `.ai_out/.../IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md`, `.../IMPLEMENTATION_REVIEW__PUBLIC.md` —
  the two `#QUESTION_FOR_HUMAN` blocks covering D1/D2 are re-headed "Human decisions (SETTLED)" with
  the verdicts inline. Third question in each (the 15px "still airy" lever) left open — it was not
  decided.

## Deliberately left alone

- `docs-internal/architecture-map.md` — its rectpacking sentence is still accurate after the split
  (it describes the algorithm, never claimed the knob fed both passes). No edit.
- `CLAUDE.md` — nothing in it is now false. No edit.
- `src/view/elkMapping.ts` comment and `src/engine/types.ts` doc — both already say interiors-only.
- `_change_log/` — TOP_LEVEL_AGENT owns it. Note that `_change_log/2026-07-28_00-47-39Z.md` still
  says "the single `elkNodeSpacingPx` knob still drives both passes", true of that commit's scope but
  stale as of the split. Flagged, not edited.
- Iteration-1 "Open questions" in the implementation artifact (tickets-dir authority, edge-free area
  regression) — unrelated to D1/D2, still open.
