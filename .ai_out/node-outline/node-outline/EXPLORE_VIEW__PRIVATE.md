# Private notes (EXPLORE view-rendering)

## Method
- Listed src/view/*, then went in this order: NoteNode.tsx (component) ->
  flowMapping.ts (data contract) -> graphIdentity.ts/constants.ts/NodeSizer.ts
  (sizing math, engine -> view) -> VicinityTraversal.ts / ObsidianLinkProvider.ts
  (firstImagePath/attachments source) -> graph-view.css (LOD via container
  queries) -> VicinityGraphFlow.tsx (nodeTypes registry, onNodeClick,
  culling) -> GraphViewController/ObsidianNoteNavigator/GraphUiContext/
  viewPorts/ObsidianGraphUi (click-to-open, hover preview, ports) ->
  FolderGroupNode.tsx (sibling comparison) -> package.json (RF version).
- Grepped repo-wide for "heading|outline" (case-insensitive) to confirm zero
  existing outline machinery, and for "zoom|useViewport|useStore" to confirm
  no zoom-dependent LOD exists beyond CSS container queries.

## Things I did NOT verify (flag for planner if it matters)
- Did not read `src/engine/index.ts`, `EdgeAccumulator.ts`,
  `NodeEligibility.ts`, `BacklinksAdapter.ts`, `CanvasCapability.ts` in
  detail — not relevant to node rendering/sizing.
- Did not confirm Obsidian's exact `CachedMetadata.headings` shape (level,
  heading text, position) by reading obsidian.d.ts — I'm relying on general
  Obsidian API knowledge (HeadingCache[] with `.level`, `.heading`,
  `.position.start.line`). Planner/implementer should grep
  node_modules/obsidian or obsidian.d.ts to nail the exact field names before
  writing adapter code.
- Did not check `esbuild.config.mjs` directly for the CSS concatenation
  mechanics — only quoted the comment in graph-view.css that describes it.
- Did not look at `VicinityGraphView.tsx` (the ItemView host) — not needed
  for this topic (registerHoverLinkSource wiring lives there per main.ts
  comment but not investigated).
- `SizingMetricLabel`/`SIZING_METRICS` in sizingMetrics.ts turned out to be
  UI-label metadata for the settings/toolbar sliders, NOT node-size
  computation — flagged this misdirection in case the planner also assumes
  that file matters; the real math is in engine/NodeSizer.ts.
- `NoteNode.tsx:36-39` doc comment mentions "step-06 Phase C/D" and similar
  step markers throughout the codebase (step-05, step-06, ticket-*) — these
  look like an internal development/ticket numbering convention from prior
  work on this repo; did not chase down what "step-06" fully entailed since
  out of scope, but planner may find it useful context if grepping for
  "step-05"/"step-06" comments near any code they touch.

## Confidence
High confidence on sections 1-4 and 6 (read exact source). Section 5 (click
seam) is accurate for what EXISTS; the "how you'd add heading-jump" part is
my own inference from Obsidian's public API (openFile(file, {eState})) since
this repo has zero precedent for it — flagged explicitly as inference, not
observed fact, in the PUBLIC doc.
