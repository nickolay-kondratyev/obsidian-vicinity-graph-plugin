# IMPLEMENTATION_PART1__PRIVATE — rehydration memory

Branch `node-outline`. My scope: **steps 1–5 only**. Steps 1–5 are committed,
the review has been answered, the tree is clean. If I am resumed again, the work
is DONE unless NEW feedback arrives.

## Commits (mine, newest first)

```
8790ddb refactor(outline): address part-1 implementation review (M1 + minors)  <- review iteration
9bb109d feat(outline): depth filter + render budget in the flow mapping (step 5)
bf17505 feat(outline): outlineMaxDepth setting, end to end (step 4)
750de65 feat(outline): outline through the engine seam + image-vs-outline rule (step 3)
adf4fb8 feat(outline): HeadingPort + reference offsets (step 2)
6e6e628 feat(outline): outline-eligibility predicate in FileKinds (step 1)
5332b14 (not mine) docs(node-outline): part-1 implementation review
```

## Verification state

- `npm run check`: clean.
- `npm test`: **790 pass / 3 fail**. The 3 are **pre-existing** on `main`
  (`22bd5cb` moved `collidePaddingPx` 20→50, `linkGapPx.max` 150→250,
  `collidePaddingPx.max` 80→100 without re-pinning baselines). Independently
  verified by TOP_LEVEL_AGENT. **Do NOT touch or re-pin them** — ticket filed:
  `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`.
  They must stay the only failures.
- Never ran `npm run test:e2e` (out of scope, needs real Obsidian).
- Logs land in `.tmp/iter-*.log`.

## Review round 1 — answered (see IMPLEMENTATION_ITERATION_PART1__PUBLIC.md)

| Finding | Disposition |
|---|---|
| M1 dead `orderedLinkTexts` | FIXED — deleted, 3 tests retargeted at `orderedReferences` via `linksOf`, empty-cache case preserved |
| m1 double resolution pass | FIXED differently — `referencesImageAbove` stops at the first heading's offset; `resolveReference` helper; **rejected** threading one array into `attachmentsOf` (canvas / no-cache branches have no offsets → would need a fake offset) |
| m2 unfailable T30 | FIXED — deleted from `GraphStructureDiff.test.ts`, replaced by 2 `GraphViewController` tests, both mutation-verified failable |
| m3 redundant SettingsSpec assertion | FIXED — deleted |
| m4 untested `isMarkdownPath` widening | FIXED — `NOTE.MD` case + 2 |
| m5 fixture hardcodes `outlineMaxDepth: 2` | **REJECTED** — fixture is deliberately engine-decoupled, every neighbour is a literal |
| m6 README/CHANGELOG | out of scope, step 10 |

## Files I touched (cumulative)

Source: `src/shared/FileKinds.ts`, `src/adapters/{ReferenceOrder,obsidianPorts,ObsidianLinkProvider}.ts`,
`src/engine/{types,LinkProvider,index,VicinityTraversal,FakeLinkProvider,SettingsSpec,constants,ViewSettingsResolver}.ts`,
`src/persistence/persistedShapes.ts`,
`src/view/{constants,flowMapping,settingsWritePlan,VicinityGraphSettingTab}.ts`,
`src/view/testFixtures/graphFixtures.ts`.

Tests: `FileKinds.test.ts`, `ReferenceOrder.test.ts`, `ObsidianLinkProvider.test.ts`,
`FakeLinkProvider.test.ts`, `VicinityTraversal.test.ts`, `VicinityEngine.test.ts`,
`SettingsSpec.test.ts`, `settingsResolvers.test.ts`, `persistedShapes.test.ts`,
`settingsWritePlan.test.ts`, `flowMapping.test.ts`, `GraphStructureDiff.test.ts`,
`GraphViewController.test.ts`. Net +53 tests.

Docs: one ticket (above). No README / architecture-map / high-level-plan /
change_log edits (step 10 + TOP_LEVEL_AGENT own those).

## Compile-forced ripples (worth remembering)

- `GraphNode.outline` required → `graphFixtures.makeNode` needs `outline: []`.
- `ViewSettings.outlineMaxDepth` required → `makeViewSettings` needs it (literal `2`).
- `FlowNodeData.outline` required → two literal `data:` objects in `flowMapping.test.ts`.
- `EngineDefaults.viewSettings()` gaining a field breaks the field-by-field
  projection assertion in `SettingsSpec.test.ts`.

## Decisions I made (not in the plan verbatim)

1. `frontmatterTitleOf` → module-level function taking `(file, cache)`.
2. Slider step read from `SETTINGS_SPEC…step` via `OUTLINE_DEPTH_SLIDER_STEP`.
3. Did NOT re-pin the 3 stale baseline tests; ticket instead.
4. **Deleted `orderedLinkTexts` even though plan D3 step 1 sketches it** — it had
   no caller; plan's own goal is "one ordering truth".
5. **Image rule is now a bounded scan**, not "find the first image then compare":
   `referencesImageAbove(offsetLimit, path, cache)` relies on `orderedReferences`
   being ASCENDING by offset (documented on that method — do not break it).
6. **T30 lives in `GraphViewController.test.ts` now**, not `GraphStructureDiff.test.ts`.

## What the NEXT agent (steps 6–10) must not be surprised by

- `NoteNode.tsx` still knows nothing about outlines (no `data-preview`, no import).
- `OpenNoteOptions` has no `heading`; no `NoteOpenContext`; `nodeOpenIntent.ts`
  does not exist; `headingLinktext` never existed here (plan M1 deletes it — not
  in the tree, nothing to delete).
- `data.outline` entries carry **RAW** heading text; `outlineEntryLabel` and the
  tree builder are step 7, unwritten.
- `toFlowNodeData` mints a fresh outline array per rebuild (filter+slice), so a
  `useMemo` keyed on it can never hit — plan D7 already says not to add one.
- `data.outline` is always present (never `undefined`) — no defensive branch.
- Step 10 still owes: README settings model + CHANGELOG entry for "Outline depth"
  (m6), plus the verify-first staleness ticket from CLARIFICATION round 2.
