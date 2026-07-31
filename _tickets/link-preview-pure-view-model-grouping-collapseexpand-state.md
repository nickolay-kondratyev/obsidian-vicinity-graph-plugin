---
id: nid_5q8dri0jtwnzwt34vfkcnw49x_e
title: 'Link preview: pure view-model (grouping + collapse/expand state)'
status: in_progress
deps: [nid_1drobt9qaq3e89gt76fzghlik_e]
links: []
created_iso: '2026-07-31T18:49:31Z'
status_updated_iso: '2026-07-31T19:56:12Z'
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
