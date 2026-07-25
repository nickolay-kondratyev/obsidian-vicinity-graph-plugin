# IMPLEMENTATION_REVIEWER — private notes (wave A, Phases 1–2)

Run 1. Verdict: **APPROVED**, 0 blocking, wave B may proceed.
Public output: `IMPLEMENTATION_REVIEW__PUBLIC.md`.

## What I actually ran (not assumed)

- `npm test` → `1 failed | 892 passed (893)`; failure = `SettingsSpec.test.ts`
  "limits equal the exact shipped baseline", `linkStrengthFactor.max` 2 vs 4.
  Pre-existing, author-only. Log: `.tmp/review-test.log`.
- `npm run check` → exit 0. Log: `.tmp/review-check.log`.
- No `sanity_check.sh` in this repo (checked).
- `npm run test:e2e` NOT run (release gate, needs real Obsidian) — I instead
  statically verified the three e2e files that could break (see below).
- Diff-hygiene greps: no `it.skip`/`it.only`/`@ts-expect-error`/`eslint-disable`
  introduced; +45/−5 `it(` (matches the claimed +40); no `main.js`/`styles.css`
  in the commits.

## The trace I did myself (the thing that mattered)

Old adapter emptied `outline` under 4 conditions; the 4th became the fact.
Only divergent cell of `nodePreviewKind` vs old logic:
`IPO=true ∧ hasImage=false` → new `"outline"`, old `"none"`.

Proof of unreachability (independent of the plan reviewer, converged on the same
conclusion):
- `referencesImageAbove` (`ObsidianLinkProvider.ts:198-209`) → true only for a
  reference that `resolveReference` resolves AND `FileKinds.isImagePath` accepts.
- `attachmentsOf` (`:272-276`) walks the SAME `OrderedReference[]` through the
  SAME `resolveReference`, filtering only `!isNodeBearingPath`.
- `NODE_BEARING_EXTENSIONS = {md, canvas}` vs `IMAGE_EXTENSIONS` — disjoint
  (`shared/FileKinds.ts:8-11`) ⇒ the image is always an attachment.
- `VicinityTraversal.ts:157` `firstImage = attachments.find(isImage)` ⇒
  `firstImagePath` defined. Attachments are NOT filtered by node exclusion
  (grepped `attachments` across `src/engine/`) — exclusion only skips node
  creation at `:123`.
⇒ `IPO ⇒ hasImage`. Cell reachable only via `FakeLinkProvider` fixtures.

Also verified the DOM-equality leg: `FlowNodeData.outline` now travels populated
in the image-wins case, but the ONLY reader is `NoteNode.tsx:105` gated on
`preview === "outline"` (grep `\.outline\b` across `src/`, non-test: only
`flowMapping.ts:64,305,319` + `NoteNode.tsx:108`). Nothing in NodeSizer /
elkMapping / GraphStructureDiff reads `outline` or `preview` ⇒ `sizePx`
independence (CLARIFICATION req 3) holds.

Frontmatter sentinel `-1`: covered by the new adapter test with heading offset 0
→ true; `referencesImageAbove` untouched, so unchanged.

## e2e statically checked (would-they-break)

- `e2e/nodeOutline.e2e.ts:264-270` (E6, image escape hatch): asserts
  `data-preview="thumbnail"` + `outlineOf(cover).toHaveCount(0)`. Still passes —
  cover node's preview is thumbnail so `NodeOutline` is not mounted. This is the
  strongest surviving guard for the zero-behavior-change claim.
- `e2e/nodeOutline.e2e.ts:302` (E7) asserts `data-preview="outline"` — unaffected.
- `e2e/settingsResetReview.e2e.ts` asserts reset LABELS (`:188`) and per-field
  values, not descriptions ⇒ the changed `node-contents` description is safe.
  `dirtyEverySection()` does not dirty the new field — that's Phase 5's cases.
- `settingsUxVisual.e2e.ts:164` — labels only. Safe.

## Findings I landed on (and the ones I deliberately did NOT raise)

SHOULD-FIX (2, both cheap, neither blocking):
1. `GraphStructureDiff.test.ts:47-56` comment overclaims. `makeNode` hard-sets
   `sizePx: 100`, and `decideLayout` never reads `nodePreviewPreference`, so a
   size↔preference coupling would NOT fail this test. What it really guards is
   "nobody adds a nodePreviewPreference relayout trigger". Reword.
2. `settingsWritePlan.test.ts:113` — node-preview test filed under
   `describe("planSettingsWrite outline depth")`. Misnamed home.

NICE-TO-HAVE: shared `NO_OUTLINE_FACTS.outline` array instance (was fresh `[]`
per call; safe, nothing mutates); `"image"` vs `"thumbnail"` vocabulary split
(don't let wave B "align" it — `data-preview` is an e2e contract); IPO measured
against the FIRST heading vs decision on the FILTERED outline (pre-existing,
documented, do not "fix"); `resourcePath` can return null ⇒ empty slot with an
unused outline, which `image` makes reachable more often (ticket, NOT a fallback
branch inside NoteNode).

Explicitly NOT raised (considered and rejected as findings):
- `parseViewOverride` now parses the field, which technically makes it per-doc
  overridable despite Q3 "global only". REQUIRED: `parsePluginData` uses the same
  parser for `globalView` (`:95`), and `ViewSettingsOverride = Partial<ViewSettings>`
  already permitted it. Q3's parenthetical anticipates this.
- The new `_assert…` idiom vs `EDGE_VISIBILITY_MODES`' plain local array. Two
  precedents already exist for the assert idiom (`forceLayoutFieldMeta.ts:67`,
  `settingsResetPlan.ts:194`); the drift is already a planned §8.4 ticket.
- `toFlowNodeData` taking whole `ViewSettings` — I argued both sides and decided
  it's the better seam (module-private mapper, avoids per-knob param growth).

## Verified the assert is not vacuous

`as const satisfies readonly NodePreviewPreference[]` keeps the tuple literal, so
`Exclude<NodePreviewPreference, (typeof NODE_PREVIEW_PREFERENCES)[number]>` is
`never` today. `UnlistedPreference` is a concrete alias, not a naked type param,
so no distribution: `never extends never ? true : …` → `true`, and an omission
yields the missing literal which fails `= true` by name. The PLAN_REVIEW inline
fix (SHOULD-FIX 1 in that doc) is genuinely applied.

## Registration audit method (reusable)

`grep -rn "keyof ViewSettings" src/` + `grep -rln outlineMaxDepth src/ e2e/`, then
diff the two file lists. Only `VicinityGraphSettingTab.ts` (Phase 3) and
`e2e/settingsResetReview.e2e.ts` (Phase 5) lack the new field — both scheduled.

## If rehydrated for wave B review

Focus then on: `esbuild.config.mjs` `AUTHORED_CSS_FILES` entry for
`segmented-control.css` (no unit test can catch its absence — plan risk §7.4);
radio `name` scoping (tab-local constant vs `useId()` in the panel — document-scoped
grouping trap); the superseded docblock at `VicinityGraphSettingTab.ts:312-320`;
e2e cases 51–53 appended LAST in the serial `nodeOutline.e2e.ts` with 53 restoring
Auto; the hand-enumerated `settingsUxVisual.e2e.ts:53-59` disclosure list (case 56);
the panel-write case 57; and whether §8.4's ticket got filed.
