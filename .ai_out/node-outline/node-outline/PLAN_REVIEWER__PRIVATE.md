# PLAN_REVIEWER__PRIVATE — `node-outline` (rehydration notes)

Review round 1 completed. Output: `DETAILED_PLAN_REVIEW__PUBLIC.md`.
Verdict issued: **MAJOR — plan iteration required**.

## What I actually verified in source (do not re-verify blindly; re-check only if the code moved)

| Claim | File / evidence | Result |
|---|---|---|
| `openLinkText` is public API | `node_modules/obsidian/obsidian.d.ts:7914`, `@public @since 0.16.0` | TRUE as planned |
| Obsidian ships heading sanitizers | `obsidian.d.ts:6835 stripHeading`, `:6841 stripHeadingForLink`, both `@public`, no `@since` (old API, safe at minAppVersion 1.12.4) | **Plan missed these — major item 1** |
| obsidian typings version / floor | `node_modules/obsidian` = 1.13.1; `manifest.json` minAppVersion 1.12.4 | fine |
| value imports from `obsidian` allowed in `src/view` | `ControlsActions.ts:1 Notice`, `ObsidianGraphUi.ts:1 Menu,setIcon`, `VicinityGraphSettingTab.ts:1`, `VicinityGraphView.tsx:1` | yes — `stripHeadingForLink` may be imported in `ObsidianNoteNavigator.ts` |
| `HeadingCache` shape | `obsidian.d.ts:3378` (`heading: string`, `level: 1..6`, extends `CacheItem` → `position.start.offset`) | `HeadingPort` structurally compatible |
| `nowheel` semantics | `@xyflow/react` **12.11.2** → `@xyflow/system` `createZoomOnScrollHandler` (returns null, no preventDefault, when `isWrappedWithClass(event, noWheelClassName)`) and `createFilter` (returns false for wheel in nowheel subtree) | plan CORRECT |
| `nopan` + wheel interaction | same `createFilter`: nopan branch requires `!isWheelEvent \|\| (panOnScroll && …)`; panOnScroll is off here | harmless |
| onNodeClick is React-synthetic | `VicinityGraphFlow.tsx:43-48,67` | `stopPropagation()` is the right lever (PinButton/AttachmentChip precedent in `NoteNode.tsx`) |
| container queries | `graph-view.css`: 72px → attachments + pin button; 104px → `.__thumbnail{display:block}`; `.__preview-zone{flex:1 1 auto}`; `.__thumbnail{min-height:56px}` | plan's D4 numbers + `flex:0 0 auto` override are right |
| `decideLayout` ignores node data | `src/view/GraphStructureDiff.ts:24-48` (groupByFolder, forceLayout fields, node ids, edge ids, sizePx growth) | outline array cannot flip layout; test 35 is a real (if cheap) guard |
| `graph.viewSettings` reaches flowMapping | `flowMapping.ts` `vicinityGraphToFlow` reads `graph.viewSettings.groupByFolder` | D7's decisive argument holds |
| `FileMetadata` implementers | grep: only `ObsidianLinkProvider.getFileMetadata` + `FakeLinkProvider` construct it | required `outline` field is low blast radius |
| `isNodeBearingPath` keys on extension | `src/shared/FileKinds.ts` (`NODE_BEARING_EXTENSIONS = md, canvas`) | `.excalidraw.md` stays a node automatically |
| `resolvedOutgoingPaths` markdown branch | `ObsidianLinkProvider.ts:150-174` (`ReferenceOrder.orderedLinkTexts` → `getFirstLinkpathDest` → `dedupe`) | refactor is mechanical; offsets unique so no tie-order hazard |
| `ReferenceOrder` today | `src/adapters/ReferenceOrder.ts` — frontmatter texts first, then links+embeds sorted by offset | `orderedReferences` extension is faithful |
| settings infra | `SettingsSpec.ts` (SETTINGS_SPEC.globalView), `ViewSettingsResolver.resolve()` per-field, `persistedShapes.parseViewOverride` `definedOnly(...)`, `settingsWritePlan` `global-view` kind spreads `ctx.globalView` | D7's 6–7 touch points are accurate |
| metadataCache listener | `src/view/VicinityGraphView.tsx:115` `metadataCache.on("resolved", …)` | plan's transparency correction is CORRECT |

## Reasoning I do not want to lose

- **Empty-outline encoding**: not a conflation problem. `NoteNode` shows the thumbnail iff
  `outline.length === 0`; "no headings" and "image wins" are downstream-identical, and the
  view-stage depth filter emptying the array folds into the same rule. Nothing needs to
  distinguish them. Approved.
- **Rejected my own simplification** of dropping the `orderedReferences` refactor and reading
  `cache.embeds` directly in `outlineOf`: `firstImagePath` derives from RESOLVED references,
  so an unresolvable `![[missing.png]]` before the first heading would suppress the outline
  yet render no thumbnail → blank node. Sharing one resolution pass is load-bearing for
  consistency. Do not let a later reviewer "simplify" this.
- **Display vs link text must stay separate**: `OutlineEntry.text` stays RAW (it is the link
  key that `stripHeadingForLink` consumes); any display cleanup is a view-layer concern.
- **Q1 is not ambiguous**: CLARIFICATION Q1 explicitly specifies a slider 1–6 default 2; Q2
  removes only an on/off toggle. Step 4 should be planned as committed work.

## Inline edits I made to `DETAILED_PLANNING__PUBLIC.md` (all tagged `<!-- PLAN_REVIEWER: … -->`)

test 21 → ordered-array assertion · added test 14b (`getFileCache` null) · annotated tests 8
and 32 as vacuous (recommend cut) · `<ul>` reset note in D5 · `data-preview` POLS note in
Step 7 · Step 8 fixture ≥10 level-1/2 headings · e2e 59 overflow precondition.

## If re-reviewing after PLAN_ITERATION, check only

1. `stripHeadingForLink` adopted in `ObsidianNoteNavigator`; `headingLinktext`/test 41
   deleted or re-scoped; the `#`-in-heading risk row and README limitation removed.
2. An explicit, tested decision on raw-markdown heading display (item 2 / question 3).
3. e2e 57's assertion replaced with something backed by a real Obsidian contract (or demoted
   to a manual dev-vault check).
4. Whether tests 8 and 32 were cut.
