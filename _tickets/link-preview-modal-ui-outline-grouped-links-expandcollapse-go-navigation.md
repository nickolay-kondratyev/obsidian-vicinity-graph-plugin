---
closed_iso: 2026-07-31T20:13:24Z
id: nid_tpghu4nsbt08slhm2vannrnqw_e
title: 'Link preview: modal UI (outline, grouped links, expand/collapse, GO navigation)'
status: closed
deps: [nid_5q8dri0jtwnzwt34vfkcnw49x_e]
links: []
created_iso: '2026-07-31T18:49:32Z'
status_updated_iso: 2026-07-31T20:13:24Z
type: task
priority: 3
assignee: nickolaykondratyev
parent: nid_tohotgq2s92dvd1iov1rd0umv_e
tags: [link-preview, ui]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Part 3/4 of parent ticket nid_tohotgq2s92dvd1iov1rd0umv_e (_tickets/show-the-preview-of-the-links.md). Depends on the view-model ticket (see deps). LOAD ${MY_DEEP_MEM}/my-frontend-design.md before designing.

Build the preview modal: an Obsidian Modal subclass (precedent: src/view/ConfirmModal.ts) hosting a React 18 root rendering the view-model.
1. NODE variant sections, in order: (a) Outline - the clicked note's headings; (b) Links - outgoing occurrences; (c) Backlinks - grouped by source note with the source note title as group header. EDGE variant: single section with only that edge's occurrences.
2. Rows: collapsed row shows shortContext; clicking the row toggles expandedContext inline (focus/center note does NOT change). Raw markdown text is acceptable for v1 (parent ticket explicitly allows it); rendered markdown is a separate follow-up ticket.
3. Each row has a GO icon (use ObsidianGraphUi renderIcon seam, src/view/ObsidianGraphUi.ts) that navigates to that occurrence: extend src/view/ObsidianNoteNavigator.ts + its NoteNavigatorPort (src/view/viewPorts.ts) with line-based navigation (openFile with eState.line), mirroring the existing heading-based option. A backlink GO opens the SOURCE note, which recenters the graph - expected per parent ticket. Modal closes on GO.
4. Header buttons: Collapse all / Expand all wired to the view-model enablement (disabled attribute + disabled styling; both visible always).
5. Styling: new src/view/link-preview.css using Obsidian theme CSS variables only (styles.css is generated at build - never hand-edit); prefer CSS over JS. Follow the design memory: clear hierarchy (group headers vs row context tiers), spacing scale, visible focus states, empty state when a group has no entries, occurrences without positions (fallback path) render without a GO icon rather than a dead control.
6. Component tests: jsdom via per-file @vitest-environment jsdom pragma + @testing-library/react (harness precedent: src/view/testFixtures/settingsPanelHarness.tsx), driven by Fake ports - cover row toggle, button enablement, GO callback payload.

## Acceptance Criteria

- Node modal shows Outline + Links + Backlinks-grouped-by-source; edge modal shows only that edge's occurrences
- Rows toggle collapsed/expanded context; Collapse all / Expand all enablement matches the view-model in all states
- GO icon navigates to the occurrence line (backlink GO recenters graph); rows without positions show no GO icon
- Component tests pass under npm test; npm run check passes

## Notes

**2026-07-31T20:13:24Z**

RESOLVED (commit db82983). Implementation:

- src/view/LinkPreviewModal.tsx — Obsidian Modal subclass (ConfirmModal precedent) hosting a React 18 root; thin by design (model is built BEFORE construction, so no loading state). Title: note title (node) / "source → target" (edge). GO closes the modal then navigates. Obsidian-coupled ⇒ e2e-covered; not yet wired to gestures (that is ticket nid_z2k1eebic1nilpz9z3r65cnrx_e).
- src/view/LinkPreviewContent.tsx — all behaviour: Outline/Links/Backlinks-grouped-by-source sections (node) or single occurrences section (edge), ContextRowCollapseState in useState, Expand/Collapse-all wired to enablement(), per-row GO icon via the renderIcon seam (Pick<GraphUiPort,"renderIcon"> passed as a prop — the modal is its own React root, so no context provider). Occurrences with context===null render a muted "No context available" row with NO toggle and NO GO icon.
- Line-based GO: LinkContextSnippet gained `line` (0-based occurrence line, computed where the snippet already splits lines); OpenNoteOptions gained `line` and ObsidianNoteNavigator opens via openFile(file, { eState: { line } }), mirroring the heading branch.
- src/view/link-preview.css (registered in esbuild.config.mjs AUTHORED_CSS_FILES) — theme variables only; CSS-only disclosure marker driven by aria-expanded; visible :focus-visible rings on the unstyled controls; empty states per section; count pills.
- Tests: src/view/LinkPreviewContent.component.test.tsx (jsdom pragma + @testing-library/react) covers section order/grouping, row toggle both ways, bulk-button enablement matrix incl. zero-row case, GO payloads (links → clicked note, backlinks → SOURCE note, edge → edge source), GO-does-not-toggle, renderIcon seam, fallback rows, empty states. Engine snippet-line tests added; existing snippet fixtures updated for the new field.

npm test: 106 files / 1430 tests pass. npm run check + npm run build pass.
