---
id: nid_tpghu4nsbt08slhm2vannrnqw_e
title: "Link preview: modal UI (outline, grouped links, expand/collapse, GO navigation)"
status: open
deps: [nid_5q8dri0jtwnzwt34vfkcnw49x_e]
links: []
created_iso: 2026-07-31T18:49:32Z
status_updated_iso: 2026-07-31T18:49:32Z
type: task
priority: 3
assignee: nickolaykondratyev
parent: nid_tohotgq2s92dvd1iov1rd0umv_e
tags: [link-preview, ui]
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

