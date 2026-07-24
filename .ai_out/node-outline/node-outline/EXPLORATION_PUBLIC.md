# EXPLORATION_PUBLIC — Markdown outline inside graph nodes

Feature: `node-outline` · Branch: `node-outline`

## Index (read these — they hold the detail)

| File | Covers |
|---|---|
| `EXPLORATION_PUBLIC__view-rendering.md` | React node component, thumbnail rendering, node sizing, CSS container-query level-of-detail, click handlers, React Flow specifics |
| `EXPLORATION_PUBLIC__engine-data-flow.md` | `LinkProvider`/`FileMetadata` port, `ObsidianLinkProvider`, `CachedMetadataPort`, `firstImagePath` pipeline, view-model assembly, persistence, engine purity guard |
| `EXPLORATION_PUBLIC__settings-and-infra.md` | `SETTINGS_SPEC` end-to-end pattern, settings-tab UI idioms, note-opening path + heading-open options, docs to update, vitest/Playwright infra |

## Cross-cutting facts (agreed by all three explorers)

- The natural data path mirrors `firstImagePath` exactly:
  `metadataCache.getFileCache().headings` → `CachedMetadataPort.headings` (**must be added**) → `ObsidianLinkProvider.getFileMetadata` → `FileMetadata.outline` → `TraversedNode`/`GraphNode.outline` → `flowMapping.toFlowNodeData` → `FlowNodeData.outline` → `NoteNode.tsx`.
- **Zero heading/outline code exists in the repo today.**
- Node size is decided in `graphIdentity.nodeDimensionsPx` (height = engine `sizePx`, default 40–160px; width from capped title estimate) and applied as explicit React Flow `Node.width/height` + `style`.
- The **only** existing level-of-detail mechanism is CSS `container-type: size` with `@container (min-height: …)` breakpoints (72px, 104px). No zoom-dependent or JS-measured rendering exists. → "enough space to show the outline" should be a CSS container query, not JS measurement.
- Excalidraw is **not** a distinguished file kind — `.excalidraw.md` is plain markdown to this codebase. Excluding it needs an explicit rule (path/extension or frontmatter check).
- Note opening has no heading seam: `OpenNoteOptions` is `{ newTab: boolean }` only. Adding a heading target is additive on `viewPorts.ts`.
- No persisted-shape version bump needed (outline is live-recomputed, never persisted).
- **Risk — staleness**: no `metadataCache.on("changed")` listener exists; rebuilds fire only on active-file switch, rename, delete. Editing headings won't refresh that note's outline.
- **Risk — memo stability**: `flowMapping.test.ts:416-445` pins `firstImagePath` as a primitive string for `useMemo` stability. An outline **array** needs flattening or careful memoization.
- **Testing reality**: no RTL/jsdom — React components are not unit-tested. Decision logic must be extracted into pure colocated `*.test.ts` modules (`nodePinAction.ts` pattern); DOM behavior is covered by Playwright e2e only (release gate).
