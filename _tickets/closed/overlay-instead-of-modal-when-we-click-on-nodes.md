---
closed_iso: 2026-07-31T21:30:20Z
id: nid_5j9mygfywppaiakuim3utf6r2_e
title: overlay instead of modal when we click on nodes
status: closed
deps: []
links: []
created_iso: '2026-07-31T21:20:22Z'
status_updated_iso: 2026-07-31T21:30:20Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now we when we click on a on node or links we have a modal pop up which is awkward UI flow.

I am thinking instead of the modal pop up let's try a slide out from the bottom with the same information and when we click in the empty parts of the graph the slide out would go away. I am thinking IF we have the graph on the side then slide out go from the bottom. IF we have the graph at the bottom then slide out goes from the side.

## Resolution (2026-07-31)

Implemented as an in-graph slide-out drawer; the Obsidian modal is deleted
(`LinkPreviewModal.tsx`, `ObsidianLinkPreview.ts` — clean break, no shims).

- **Seam unchanged**: `GraphViewController` still talks to `LinkPreviewPort`.
  It is now implemented by `src/view/LinkPreviewOverlayStore.ts` — a pure
  external store (`useSyncExternalStore`-shaped) holding the previewed model —
  rendered by `VicinityGraphFlow` as `src/view/LinkPreviewDrawer.tsx`, which
  hosts the pre-existing `LinkPreviewContent` (same information as the modal:
  title, outline/links/backlinks or edge occurrences, expand/collapse, GO).
- **Slide direction is pure CSS** (no JS measuring): `.vicinity-graph-flow`
  is a size query container (`graph-view.css`); `link-preview.css` defaults
  the drawer to a bottom sheet and a `@container (min-aspect-ratio: 1/1)`
  query flips a WIDE pane (graph docked at the bottom / main area) to a
  right-side sheet — exactly the ticket's side/bottom rule, driven by the
  pane's own aspect ratio. Slide-in animated, `prefers-reduced-motion` honored.
- **Dismissal**: click on the empty graph pane (`onPaneClick`), Escape, the
  header close button, or GO (which navigates, as the modal did). Clicking
  another node/edge retargets the drawer in place; an emptied graph closes it.
- **Tests first**: `LinkPreviewOverlayStore.test.ts` (store semantics) and
  `LinkPreviewDrawer.component.test.tsx` (title per model kind, close button,
  Escape, close-on-GO). `npm test` 1450/1450 green, `npm run check` and
  `npm run build` clean. Docs updated (`architecture-map.md`); changelog entry
  `t54b3ohbfwghjsut1b7g548xy`.
- **Not e2e-verified in a real Obsidian window** (release-gate suite not run
  here); the only CSS-query-specific behavior (which edge it slides from) is
  untestable under jsdom by nature.
