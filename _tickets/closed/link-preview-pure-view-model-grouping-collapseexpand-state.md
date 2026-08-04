---
closed_iso: 2026-07-31T20:01:45Z
id: nid_5q8dri0jtwnzwt34vfkcnw49x_e
title: 'Link preview: pure view-model (grouping + collapse/expand state)'
status: closed
deps: [nid_1drobt9qaq3e89gt76fzghlik_e]
links: []
created_iso: '2026-07-31T18:49:31Z'
status_updated_iso: 2026-07-31T20:01:45Z
type: task
priority: 3
assignee: nickolaykondratyev
parent: nid_tohotgq2s92dvd1iov1rd0umv_e
tags: [link-preview]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Part 2/4 of parent ticket nid_tohotgq2s92dvd1iov1rd0umv_e (_tickets/show-the-preview-of-the-links.md). Depends on the occurrence data layer ticket (see deps).

Pure, node-env-testable modules in src/view (pattern precedent: src/view/nodePreviewChoice.ts + colocated *.test.ts):
1. Preview model builders:
   - NODE preview model for clicked note X: { outline: heading entries (reuse existing FileMetadata.outline from src/engine/LinkProvider.ts getFileMetadata - do NOT re-derive), linksGroup: X's outgoing occurrences, backlinkGroups: backlinks to X grouped per source note }
   - EDGE preview model: only the occurrences that fall under the clicked edge (source->target)
2. Collapse/expand state machine: every context row starts COLLAPSED; toggling one row is independent; derived button enablement per parent ticket: all collapsed -> Expand all enabled + Collapse all disabled; all expanded -> inverse; mixed -> both enabled. Also expandAll()/collapseAll() transitions.
3. BDD tests (WHEN/THEN, one assert per test) for grouping order (document order within a group, backlink groups ordered deterministically) and for every enablement combination incl. zero-row and single-row models.

## Acceptance Criteria

- Model builders + collapse state are pure (no obsidian/react imports) and fully BDD-tested
- Button enablement matrix covered: all-collapsed / all-expanded / mixed / empty
- npm test and npm run check pass

## Resolution (2026-07-31)

Delivered as specified; pure view-only modules, no obsidian/react imports (node-env tested). Commit `bedcdb1`.

- **`src/view/linkPreviewModel.ts`** — `LinkPreviewModels` (static class):
  - `node({path, outline, outgoing, backlinks})` → `NodePreviewModel {kind:"node", path, outline (verbatim FileMetadata.outline — never re-derived), linkRows, backlinkGroups, rowIds}`. Backlink groups sorted by source path (code-point, locale-independent) because the adapter's group order follows cache-map iteration; occurrences within every group keep document order.
  - `edge({sourcePath, targetPath, occurrences})` → `EdgePreviewModel` over the already edge-scoped `occurrencesBetween` result.
  - Rows carry stable group-qualified ids (`links:<i>`, `backlink:<src>:<i>`, `edge:<i>`); `rowIds` is the display-order universe fed to the collapse state.
- **`src/view/contextRowCollapse.ts`** — immutable `ContextRowCollapseState`: `allCollapsed(rowIds)` (throws on duplicate ids), `toggled(id)` (independent per row; unknown id throws), `expandedAll()`, `collapsedAll()`, `enablement()` → `{expandAllEnabled, collapseAllEnabled}`. Matrix: all-collapsed → expand only; all-expanded → collapse only; mixed → both; zero rows → both disabled.
- **BDD tests** (WHEN/THEN, one assert each): `linkPreviewModel.test.ts` (outline pass-through, document order in links + backlink groups, deterministic group sort, id uniqueness, links-before-backlinks display order, empty models, edge order/ids) and `contextRowCollapse.test.ts` (initial collapsed, toggle independence/round-trip, bulk transitions, full enablement matrix incl. zero-row and single-row, duplicate/unknown id throws).

Verification: `npm run check` passes; `npm test` fully green (105 files / 1407 tests).
