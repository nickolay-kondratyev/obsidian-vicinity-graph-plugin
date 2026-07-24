# IMPLEMENTATION_PART1__PRIVATE — rehydration memory

Branch `node-outline`. My scope: **steps 1–5 only**. All five are committed and
the tree is clean. If I am resumed, the work is DONE unless review feedback
arrives.

## Commits (mine, newest first)

```
9bb109d feat(outline): depth filter + render budget in the flow mapping (step 5)
bf17505 feat(outline): outlineMaxDepth setting, end to end (step 4)
750de65 feat(outline): outline through the engine seam + image-vs-outline rule (step 3)
adf4fb8 feat(outline): HeadingPort + reference offsets (step 2)
6e6e628 feat(outline): outline-eligibility predicate in FileKinds (step 1)
47c8d3d (not mine) plan(node-outline): revised plan ...
```

## Verification state

- `npm run check`: clean.
- `npm test`: 787 pass / 3 fail. The 3 are **pre-existing** (`22bd5cb` moved
  `collidePaddingPx` 20→50, `linkGapPx.max` 150→250, `collidePaddingPx.max`
  80→100 without re-pinning baselines). Verified identical failures at baseline
  BEFORE I touched anything (`.tmp/baseline-test.log`: 737 pass / same 3 fail).
  Deliberately not fixed → `docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md`.
- Never ran `npm run test:e2e` (out of scope, needs real Obsidian).

## Files I touched

Source: `src/shared/FileKinds.ts`, `src/adapters/{ReferenceOrder,obsidianPorts,ObsidianLinkProvider}.ts`,
`src/engine/{types,LinkProvider,index,VicinityTraversal,FakeLinkProvider,SettingsSpec,constants,ViewSettingsResolver}.ts`,
`src/persistence/persistedShapes.ts`,
`src/view/{constants,flowMapping,settingsWritePlan,VicinityGraphSettingTab}.ts`,
`src/view/testFixtures/graphFixtures.ts`.

Tests: `FileKinds.test.ts`, `ReferenceOrder.test.ts`, `ObsidianLinkProvider.test.ts`,
`FakeLinkProvider.test.ts`, `VicinityTraversal.test.ts`, `VicinityEngine.test.ts`,
`SettingsSpec.test.ts`, `settingsResolvers.test.ts`, `persistedShapes.test.ts`,
`settingsWritePlan.test.ts`, `flowMapping.test.ts`, `GraphStructureDiff.test.ts`.
+50 tests total. No test removed or weakened.

Docs: one new ticket (above). No README / architecture-map / high-level-plan /
change_log edits (step 10 + TOP_LEVEL_AGENT own those).

## Compile-forced ripples I hit (worth remembering)

- `GraphNode.outline` required → `src/view/testFixtures/graphFixtures.ts`
  `makeNode` needed `outline: []`.
- `ViewSettings.outlineMaxDepth` required → same file's `makeViewSettings`
  needed `outlineMaxDepth: 2`.
- `FlowNodeData.outline` required → two literal `data:` objects inside
  `flowMapping.test.ts` (the `withPositions`/`withGroupDimensions` fixtures and
  the "step-05 rich payload" `toEqual`) needed `outline: []`.
- `EngineDefaults.viewSettings()` gaining a field broke the field-by-field
  projection assertion in `SettingsSpec.test.ts` → added the one line.

## Decisions I made (not in the plan verbatim)

1. `frontmatterTitleOf` → module-level function taking `(file, cache)`. It stopped
   using `this` once the cache became a parameter; the file's local idiom is
   module-level helpers.
2. Slider step from `SETTINGS_SPEC…step` via `OUTLINE_DEPTH_SLIDER_STEP`, not a
   literal `1`.
3. Did NOT re-pin the 3 stale baseline tests; filed a ticket instead.

## What the NEXT agent must not be surprised by

- `NoteNode.tsx` still knows nothing about outlines (no `data-preview`, no import).
- `OpenNoteOptions` has no `heading`; no `NoteOpenContext`; `nodeOpenIntent.ts`
  does not exist; `headingLinktext` never existed here (plan M1 deletes it — it
  is not in the tree, so nothing to delete).
- `data.outline` entries carry **RAW** heading text; the display stripper
  (`outlineEntryLabel`) and the tree builder are step 7, unwritten.
- `toFlowNodeData` mints a fresh outline array per rebuild (filter+slice).
