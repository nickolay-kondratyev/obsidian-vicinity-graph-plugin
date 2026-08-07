---
id: nid_hyzwoqadcfyvisveczuet3e8c_e
title: "Design showcase: 10 external-URL graph node variants (human picks one)"
status: open
deps: []
links: [nid_mw1az1i1aznfoxqsgcwnfus07_e, nid_prsk9olcj9u2fpzqgv5gb6zhe_e, nid_ccsw8o1rjcs2l7o1elgmlqx5i_e, nid_uqgew1fuqgrdyvas6eum6vaf2_e]
created_iso: 2026-08-07T00:01:58Z
status_updated_iso: 2026-08-07T00:01:58Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: [ui, decide, external-url]
---

# Design showcase — external-URL graph node (pick 1 of ~10)

Parent: `nid_mw1az1i1aznfoxqsgcwnfus07_e` (planning). Blocks the VIEW ticket
`nid_ccsw8o1rjcs2l7o1elgmlqx5i_e`, which renders the chosen design.

## Goal

Produce a visual showcase of **~10 distinct designs** for a NEW graph node kind:
an **external URL** that a central/pinned note links out to. The human picks ONE;
that pick is the spec the VIEW ticket implements. This is a `decide` ticket —
the deliverable is a decision, captured back in this ticket's body.

## Why a distinct node

Today the graph has exactly two node kinds — `note` and `folder-group`
(`src/view/VicinityGraphFlow.tsx:41`, `NODE_TYPES`). An external URL is neither:
it is not a vault document, has no folder, no outline, no thumbnail, no pin/resize
semantics. The node must read INSTANTLY as "this is an external link, not a note
in your vault" so the user is never confused about what opening it does (it leaves
Obsidian for the browser).

## Hard constraints (bake into every variant)

- **NO network calls, ever.** No favicon fetch, no OpenGraph/title fetch, no image
  load from the URL's host. This is the core trust constraint of the parent ticket:
  the plugin must not phone home. Designs may show a **static, bundled** glyph
  (e.g. a globe / link / external-arrow icon) but never a remote asset.
- **The only text we have is the note author's ALIAS** (the markdown link display
  text, e.g. `[OpenAI docs](https://…)` → `OpenAI docs`). We deliberately render
  ONLY aliased URLs (see parent ticket). Show the alias as the primary label; the
  raw URL host may appear as secondary/subtle text or a tooltip — designer's call
  per variant.
- **Theme-native.** Pull all color from Obsidian theme CSS variables (light/dark
  must both work) — same convention as `src/view/graph-view.css`. No hardcoded hex.
- **Visually distinct from `note` nodes** at a glance: different shape/chrome
  (e.g. pill/capsule, dashed border, chip, accent color, corner ribbon, leading
  glyph), not just a different label.
- Must look sane at small sizes — a URL node carries little content, so it will be
  small. No thumbnail slot, no outline, no attachment strip.
- **Show a link-vs-embed distinction (D4).** A URL can arrive as a plain hyperlink
  (`[x](url)`) or an external EMBED (`![x](url)`, the main use case). At least some
  variants should show how the two read differently (e.g. distinct glyph: hyperlink
  vs embedded-resource) so the pick covers both — OR argue a single treatment is
  better. The node also carries an `×N` count badge on its incoming edge when the
  central references it multiple times; keep the design legible with that badge.

## Deliverable

A self-contained **HTML showcase** (Artifact is fine — see the `artifact-design`
skill) OR a set of screenshots, laid out as a grid of ~10 labelled variants, each
rendered in BOTH light and dark theme mockups, using representative aliases
(short, long, and one that must truncate). Each variant gets a short caption
naming its idea (e.g. "V3 — dashed capsule + globe glyph"). Include one mockup of
a small cluster (a central note with 2–3 URL nodes fanning out with directed
edges) so grouping/legibility is judged in context, not in isolation.

Do NOT wire anything into the real React Flow view here — this is a design
artifact only. Keep it in `.out/` or as an Artifact; do not source-control PNGs.

## Acceptance

- ~10 clearly-distinct variants, light+dark, with the constraints above visibly
  satisfied (no remote assets).
- Human selects one; record the choice (and any tweak notes) in this ticket body,
  then close. The VIEW ticket reads that selection.

## Suggested approach

Use the `PRINCIPAL_UX_DESIGNER` role / `ui:iterate-on-design` skill. Reuse the
node chrome vocabulary already in `src/view/graph-view.css` (attribute-selector
styling, theme vars) so the winning design ports cleanly.

