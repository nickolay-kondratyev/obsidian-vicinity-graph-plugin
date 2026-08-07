---
id: nid_ccsw8o1rjcs2l7o1elgmlqx5i_e
title: "External URLs in graph — view rendering (new node kind)"
status: open
deps: [nid_hyzwoqadcfyvisveczuet3e8c_e, nid_prsk9olcj9u2fpzqgv5gb6zhe_e]
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e, nid_hyzwoqadcfyvisveczuet3e8c_e, nid_prsk9olcj9u2fpzqgv5gb6zhe_e, nid_uqgew1fuqgrdyvas6eum6vaf2_e]
created_iso: 2026-08-07T00:01:59Z
status_updated_iso: 2026-08-07T00:01:59Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [view, ui, external-url, decide]
---

# External URLs in the graph — view rendering (new node kind)

Parent: `nid_mw1az1i1aznfoxqsgcwnfus07_e` (planning). This is the RENDER half.

**Depends on:**
- `nid_prsk9olcj9u2fpzqgv5gb6zhe_e` (engine/adapter) — supplies the url-node +
  edge data.
- `nid_hyzwoqadcfyvisveczuet3e8c_e` (design showcase) — supplies the chosen visual
  design. Do NOT start rendering until the human has picked a design there.

## Goal

Render the engine's external-URL nodes as a THIRD React Flow node kind, visually
distinct from note nodes, so the user sees what their central/pinned notes link
out to on the web. Alias is the label; clicking opens the URL in the browser.

## Where it plugs in (confirmed by exploration)

Today there are exactly two node kinds, a discriminated `FlowNode` union keyed on
`kind` and a `NODE_TYPES` map:
- `src/view/flowMapping.ts:124-134` — `FlowNode = NoteFlowNode | GroupFlowNode`
  (`kind: "note" | "folder-group"`); `vicinityGraphToFlow(graph, mainPinned)`
  (~line 205) builds the RF nodes; `withPositions`/`withGroupDimensions`
  (~435/459) apply layout generically by `id`/`kind` and pass a third kind through
  unchanged as long as it carries `FlowNodeBase`.
- `src/view/VicinityGraphFlow.tsx:41` — `NODE_TYPES = { note: NoteNode,
  "folder-group": FolderGroupNode }`.
- `src/view/NoteNode.tsx` / `src/view/FolderGroupNode.tsx` — the
  `memo(function X({ data }: NodeProps<Type>))` shape to mirror.
- `src/view/graph-view.css` — attribute-selector node chrome (`[data-tier]`,
  `[data-preview]`); add URL styling in the same idiom (e.g. a `data-kind` attr or
  a dedicated class). Theme vars only.

## Steps

1. Add a third variant to the `FlowNode` union in `src/view/flowMapping.ts`
   (e.g. `UrlFlowNode` with `kind: "external-url"` and a small `data` shape:
   `{ url, alias }`). Map the engine's `externalUrlNodes` + `externalUrlEdges`
   (from the engine ticket) into RF nodes/edges inside `vicinityGraphToFlow`.
   The url-node's size is a small FIXED box (no content-fit sizing — it has no
   note content); pick dimensions from the chosen design.
2. New `src/view/UrlNode.tsx` mirroring `NoteNode.tsx`'s memo/NodeProps shape,
   rendering the CHOSEN design: alias label, static bundled glyph, edge `Handle`(s).
   NO thumbnail / outline / attachment strip / pin / gear / resize controls.
3. Register it in `NODE_TYPES` (`src/view/VicinityGraphFlow.tsx:41`).
4. CSS in `src/view/graph-view.css` per the chosen design, theme-native.
5. **Click behavior [D3 — confirm]:** clicking a url-node opens the URL in the
   default browser. PROPOSED: `window.open(url, "_blank")` (Obsidian desktop routes
   this to the OS browser). No hover preview, no in-Obsidian webview. Decide whether
   a modifier (ctrl/cmd) does anything (proposed: no alternate target — it is
   already an external open).
6. Edges central→url render as normal directed edges (existing edge machinery);
   confirm arrowhead/curvature reads correctly when a central fans out to several
   url-nodes.
7. Layout: url-nodes are ungrouped (no folder). Confirm elk places them sanely
   around their central; they are leaf nodes with a single incoming edge.

## Testing

- Component test under jsdom (`@vitest-environment jsdom`, per the repo's
  `*.component.test.tsx` pattern) for `UrlNode`: renders alias, has no note-only
  chrome, click invokes the open handler with the URL.
- `flowMapping` unit test: engine url-nodes/edges map to the new `FlowNode` kind.
- **e2e** (`npm run test:e2e`, REQUIRED — this is a view-layer/DOM/CSS change per
  CLAUDE.md): a real note with `[alias](https://example.com)` as MAIN shows a
  distinct url-node with the alias; a bare-URL note shows none; a non-central
  neighbour's URL shows none. Add to the existing `e2e/vicinityGraph.e2e.ts`
  surface or a sibling spec.

## Acceptance

- URL nodes render in the chosen design, clearly distinct from notes, click-opens
  the URL, no network calls. `npm test`, `npm run check`, and the touched
  `npm run test:e2e` specs green.

