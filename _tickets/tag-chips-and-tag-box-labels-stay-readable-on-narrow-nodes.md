---
closed_iso: 2026-11-17T22:14:29Z
id: nid_mf28gwba8b6aihah05jtjj34z_e
title: "Tag chips and tag box labels stay readable on narrow nodes"
status: closed
deps: []
links: []
created_iso: 2026-11-17T21:58:08Z
status_updated_iso: 2026-11-17T22:14:29Z
type: bug
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [tags-v1]
parent: nid_xhed75cwiy0ui4fokv6l02cxf_e
---

## Goal
Tag chips and tag box labels are readable at real node sizes. Screenshots of the shipped tags V1 (owner-facing quality bar: "final working product") show two defects:
1. On a narrow note, its leftover-tag chips shrink to a bare `#…` (e.g. three chips rendered as `#…`, `#…`, `#refe…`) — they carry no information.
2. Tag box labels clip inconsistently: one multi-tag label (`#follow-up #important`) is cut from the LEFT with no ellipsis (shows `p #important` — looks like the folder full-path front-truncation leaking onto tag boxes), another is ellipsed at the end (`#follow-…`).

Part of epic `nid_xhed75cwiy0ui4fokv6l02cxf_e`.

## Done criteria
- No visible chip ever renders as a bare `#…`: every chip shown is readable (full tag, or at least a meaningful prefix of a named minimum length); chips that don't fit fold into the `+N` chip; the full leftover tag list is available on hover (tooltip) of the chip row / `+N`. Prefer CSS; if JS measuring is needed, keep it cheap and explain why. Chip space reservation (the tag-box bottom inset in `src/view/groupBoxPadding.ts`) must stay correct — one chip row only.
- Tag box labels truncate the same way everywhere: at the END with an ellipsis, never front-clipped; the full label is in the tooltip. Folder box behavior (incl. the "Full folder path" front truncation) unchanged.
- Tests: unit/component tests for the chip-fitting rule and the label truncation mode choice; e2e coverage only if a journey changes (no CSS/look assertions). Capture before/after screenshots into `.out/` (git-ignored) for a narrow-node fixture and report their paths.
- `npm run check`, `npm test`, and `npm run test:e2e -- tagGrouping.e2e.ts tagFilterEntryPoints.e2e.ts nestedGrouping.e2e.ts folderGroupLabelNav.e2e.ts` green.

## Context
- Chips: `NoteTagChips` in `src/view/NoteNode.tsx`, data from `src/view/tagChips.ts` (cap of 3 + `+N`), styles in `src/view/graph-view.css`.
- Box labels: `src/view/FolderGroupNode.tsx`; `fullPathLabel` / label truncation logic and CSS (`direction: rtl`-style front truncation is the likely leak).
- Screenshots showing the defects: produced by a throwaway spec; reproduce with the tag fixtures in `e2e/tagGrouping.e2e.ts`.

## Non-goals
- Multi-row chip wrapping, chip colours, node sizing changes.
