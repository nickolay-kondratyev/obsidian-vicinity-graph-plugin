---
closed_iso: 2026-08-18T02:12:12Z
session_ids: [{"a": "claude", "type": "execution", "id": "ff565023-b599-4bc4-bc56-35a569bedc33"}, {"a": "claude", "type": "review", "id": "1bc4311b-3702-4562-ac2b-2d8392cd5520"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_wnagjm2j144u0jsgixpcmmpar_e
title: "Named relationships: edge labels + flyout breakdown (view)"
status: closed
deps: [nid_wldz7yfjecf9fuwtlezlbde9s_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-18T02:12:12Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

View layer, V1 rendering:
- Edge shows ALL its relation names (simple readable rendering — e.g. stacked/joined label; the dedicated GREAT-UI ticket iterates on presentation). A relation WITH a qualifier renders as `supports [X] but not strongly` — literal `[X]` marks the target position, never the note title (the edge already points at the target). Count badge for multiplicity coexists. One edge per ordered pair unchanged ("collapse, don't multiply").
- Edge flyout (src/view/LinkPreviewDrawer.tsx, src/view/LinkPreviewContent.tsx, occurrence seam src/engine/LinkOccurrenceProvider.ts) gains the full breakdown: relation names + qualifiers, context snippets for statement occurrences, and rel-note labels LINKING to their rel note.
- Styling via Obsidian theme CSS variables; CSS over JS.

Tests: jsdom component tests per the *.component.test.tsx pattern + `npm run test:e2e` (view-layer DOM/CSS changes are an e2e-required surface; e2e tests live in the e2e/ submodule — commit there first).

--------------------------------------------------------------------------------

## Resolution (2026-08-17)

Done. The engine already carried the relation data (`GraphEdge.relations`, a
`RelationLabel[]` of name/qualifier/relNoteTarget, fully populated by
`EdgeAssembly` from the deps ticket). This ticket plumbed it through the view to
the canvas edge label and the edge flyout. No engine or adapter change needed.

**What was built / where it lives**

- **Data plumbing (`src/view/flowMapping.ts`).** Following the codebase's
  existing `hierarchy`-on-both pattern, relation labels now ride BOTH the
  per-pair `EdgeNotePair.relations` (flyout attribution) AND the edge-level
  `FlowEdge.relations` glance-level UNION (canvas label). New helpers:
  `relationLabelKey` (dedup identity = `name\0qualifier\0relNoteTarget`, mirrors
  the engine), `notePairOf`, `addRelationLabels`. The collapsed-edge accumulator
  unions contributors deduped in first-seen order; passthrough edges carry their
  single pair's already-deduped labels.
- **Canvas edge label (`src/view/VicinityEdge.tsx` + `graph-view.css`).**
  `VicinityEdgeData` gained `relations`, forwarded from `FlowEdge` in
  `VicinityGraphFlow.tsx`. Labels render in a second `EdgeLabelRenderer` overlay
  STACKED ABOVE the line so the count badge keeps the midpoint (they coexist).
  Label text via `relationLabelText` in `badgeText.ts`: bare `name`, or
  `name [X] qualifier` (literal `[X]` marks the target position; `RELATION_TARGET_MARKER`
  is shared with the flyout). Multi-name presentation is deliberately simple —
  the GREAT-UI ticket `nid_1ycy9aszptp9fih76equxtcqa_e` iterates it.
- **Flyout breakdown (`src/view/linkPreviewModel.ts`, `LinkPreviewContent.tsx`,
  `link-preview.css`; wired in `GraphViewController.openEdgePreview`).** New
  `NamedRelationModel` (name, qualifier?, relNoteTarget?, sourcePath) flattened
  per sorted pair onto `EdgePreviewModel.relations`. A "Relationships" section
  (`NAMED_RELATION_SECTION_TITLE`) leads the flyout when non-empty, mirroring the
  existing folder-relation section. A rel-note name renders as a real
  `a.internal-link` (no button-chrome fight) whose click routes through the
  existing `onOpenLink` seam with the resolved rel-note path as the linktext;
  plain names are text; qualifiers trail as `[X] qualifier`. Context snippets for
  statement occurrences were already shown by the existing occurrence rows — the
  named-relationship statement rides the plain-link channel, so its occurrence is
  one of those rows; no `LinkOccurrenceProvider` change was needed (kept the seam
  thin per the 80/20 rule).

**Tests (all green): `npm run check` (0 errors), `npm test` (2369 pass, +20),
`npm run test:e2e -- namedRelationships.e2e.ts linkPreview.e2e.ts` (11 pass).**

- Unit: `flowMapping.test.ts` (union/dedup, per-pair vs edge-level, rel-note
  target survival), `badgeText.test.ts` (`relationLabelText`), `linkPreviewModel.test.ts`
  (relations flatten in sorted-pair order), `LinkPreviewContent.component.test.tsx`
  (Relationships section leads, plain/qualifier/rel-note rendering, rel-note link
  click → `onOpenLink`).
- E2E: new `e2e/namedRelationships.e2e.ts` — a bare `supports` + bracketed
  `[refutes:: … but not strongly]` onto one target (two stacked labels + `×2`
  badge coexisting + flyout breakdown) and a rel-note `[[approves]]:: [[…]]`
  (flyout link to the rel note). Relation labels/badge render into React Flow's
  SHARED `EdgeLabelRenderer` overlay (not the edge's `<g>`), so they are matched
  globally — safe because each opened main's vicinity holds exactly one named
  edge.

Next reader notes: `main.js`/`styles.css` are gitignored build artifacts in this
checkout (regenerated at release), so there was nothing to commit for them. The
`e2e/` directory is a flattened set of normally-tracked files here (no submodule
gitlink), so its changes commit in the parent repo like any other file.


## Notes

**2026-08-18T02:15:55Z**

__READY_AS_IS__: Reviewed full diff; found no bugs. check + npm test (2369) + namedRelationships.e2e.ts (4) all pass. Data plumbing, dedup identity mirrors engine, flyout attribution and rel-note link routing all correct; multi-name canvas presentation deliberately deferred to GREAT-UI ticket per scope. No changes made.
