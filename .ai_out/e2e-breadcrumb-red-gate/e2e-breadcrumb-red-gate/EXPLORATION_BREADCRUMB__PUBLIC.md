# EXPLORATION — breadcrumb render path

> Produced by a read-only Explore agent (could not Write); transcribed by TOP_LEVEL_AGENT.

## Headline

**`vicinity-graph-node__breadcrumb` exists nowhere in `src/`.** It appears only in
`e2e/vicinityGraph.e2e.ts:86` and `:161`. The breadcrumb is an **unimplemented feature**,
not a broken one. The sibling test at `:85` passes only because it asserts
`toHaveCount(0)` — nothing renders a breadcrumb for *any* note.

## 1. Class production sites

Repo-wide grep for `breadcrumb` (case-insensitive) in `src/**` → one unrelated comment:
- `src/adapters/ObsidianLinkProvider.ts:313` — "…would leak into rendered titles and breadcrumbs" (about wikilink syntax).

e2e occurrences:
- `e2e/vicinityGraph.e2e.ts:85-87` — root note: `.vicinity-graph-node__breadcrumb` `toHaveCount(0)`.
- `e2e/vicinityGraph.e2e.ts:160-165`:
  ```ts
  await expect(noteNode(GAMMA_PATH).locator(".vicinity-graph-node__breadcrumb")).toHaveText("solo/");
  await expect(noteNode(GAMMA_PATH).locator(".vicinity-graph-node__title")).toHaveText(
      `solo/${GAMMA_TRIMMED_TITLE}`,
  );
  ```
  `GAMMA_TRIMMED_TITLE = "Gamma (solo, trimmed title)"` (no folder prefix). Because
  Playwright `toHaveText` concatenates descendant text, the **intended DOM shape** is a
  `.vicinity-graph-node__breadcrumb` span **nested inside** `.vicinity-graph-node__title`,
  immediately before the title text — not a sibling elsewhere in the node.

Current render — `src/view/NoteNode.tsx:92-94`:
```tsx
<div className="vicinity-graph-node__title" title={data.title}>
    {data.title}
</div>
```

## 2. Where breadcrumb data would come from

- `GraphNode.folder: FolderPath` — populated in `src/engine/VicinityTraversal.ts` via `LinkProvider`;
  branded in `src/engine/types.ts:21,31-32` (`""` = vault root).
- `src/view/flowMapping.ts:302-332` (`toFlowNodeData`) copies `folder: node.folder` into
  `FlowNodeData.folder` (`flowMapping.ts:54-55`, `:317`) but derives **no** breadcrumb string;
  `title: node.title` (`:310`) passes through unmodified.
- `GraphNode.title` — `VicinityTraversal.ts:162`:
  `title: metadata.frontmatterTitle ?? VaultPathFacts.titleOf(path)`.
- Helpers in `src/shared/VaultPathFacts.ts`: `folderOf` (`:18-21`), `folderNameOf` (`:24-26`,
  used today only for group labels at `flowMapping.ts:181`). **No** trailing-slash
  (`"solo/"`) formatting exists anywhere.

## 3. Singleton-folder behaviour (why this note has no group box)

- `src/view/folderGrouping.ts:24-25`:
  ```ts
  /** Groups render only at 2+ members (step-05 spec); singletons render ungrouped. */
  export const MIN_GROUP_MEMBER_COUNT = 2;
  ```
- `deriveFolderGroups` (`:36-54`): vault-root notes (`folder === ""`) skipped (`:42-44`);
  folders with `< 2` members dropped from `groups` **and** from `groupFolderByMemberPath` (`:51-54`).
- `flowMapping.ts:187-195`: `parentId` set only when `groupFolderByMemberPath.has(node.path)`.
  So `solo/gamma.md` renders as a plain note node, `data.folder = "solo"`, no `parentId`.
- `src/view/FolderGroupNode.tsx:32-35` renders `data.folderName` in the group header for
  multi-member folders → design intent: grouped folders show the name on the **group box**;
  ungrouped non-root notes need it on the **node** as a breadcrumb.

## 4. Existing unit coverage

**None.** Zero matches for "breadcrumb" in `src/**/*.test.ts(x)` (incl.
`src/view/folderGrouping.test.ts`, `src/view/flowMapping.test.ts`).

## 5. Suggested shape of a fix (from the explorer, not binding)

(a) In `flowMapping.ts` / `toFlowNodeData`: derive breadcrumb text when
`node.folder !== "" && !grouping.groupFolderByMemberPath.has(node.path)` → `folder + "/"`.
(b) In `NoteNode.tsx:92-94`: render a `.vicinity-graph-node__breadcrumb` span inside
`.vicinity-graph-node__title`, before `{data.title}`.

**Open question for IMPLEMENTATION:** confirm against
`docs-internal/plan/high-level-plan.md` whether the breadcrumb is a specified feature
(then implement it) or whether the e2e expectation is wrong (then correct the test with
written rationale). Both are permitted by the ticket's acceptance criteria.
