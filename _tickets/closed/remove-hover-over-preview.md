---
closed_iso: 2026-08-03T23:24:17Z
id: nid_jnw75pg24q4itujs8vfgqj4mh_e
title: remove hover over preview
status: closed
deps: []
links: []
created_iso: '2026-08-03T23:20:30Z'
status_updated_iso: 2026-08-03T23:24:17Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Remove the hover over preview on the note.

## Resolution (2026-08-03) — DONE

Hovering a graph node no longer fires Obsidian's native page preview. What was removed:

- `src/view/NoteNode.tsx` — the `onMouseEnter` handler that armed the preview.
  Its wrapper div stays (it is load-bearing layout: it flex-grows so the
  attachment strip sits on the node's bottom edge) but is renamed
  `vicinity-graph-node__preview-zone` -> `vicinity-graph-node__content`, since
  the old name named a preview that no longer exists.
- `src/view/viewPorts.ts` — `HoverPreviewRequest` and `GraphUiPort.showHoverPreview`.
- `src/view/ObsidianGraphUi.ts` — the `hover-link` trigger, the `HoverParent`
  implementation / `hoverPopover` field, and the `hoverSourceId` constructor arg
  (call site in `src/view/VicinityGraphView.tsx` updated).
- `src/main.ts` — `registerHoverLinkSource(...)`, so the graph no longer appears
  as a source in the Page-preview core-plugin settings.
- `src/view/graph-view.css` — the hover-dead-zone rationale; the class renamed
  in all three rules.

Docs updated: `README.md` (interactions list), `docs-internal/plan/high-level-plan.md`
(goals + interactions), `docs-internal/plan/steps/step-05-rich-rendering.md`, and the
still-open `docs-internal/tickets/ticket-link-preview-modal-human-smoke-run.md`
step 7 (it told a human to verify the preview still fires). The step-05 smoke-run
ticket is a historical run record and was left as-is.

Tests: `e2e/vicinityGraph.e2e.ts`'s hover-dead-zone test was retargeted to the
layout invariant it still captures (chips are siblings of the content zone, so the
zone's flex-grow pins them to the bottom edge) rather than deleted.

Verified: `npm run check` clean, `npm test` 1473 passed, `npm run test:e2e -- vicinityGraph.e2e.ts` 25 passed.
