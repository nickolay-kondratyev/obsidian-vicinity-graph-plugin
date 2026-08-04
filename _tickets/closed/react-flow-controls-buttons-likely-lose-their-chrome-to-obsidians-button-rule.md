---
closed_iso: 2026-08-01T05:47:59Z
id: nid_m82om4ibnj0ouggbpenicdkce_e
title: React Flow Controls buttons likely lose their chrome to Obsidian's button rule
status: closed
deps: []
links: []
created_iso: '2026-08-01T05:38:24Z'
status_updated_iso: 2026-08-01T05:47:59Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
src/view/VicinityGraphFlow.tsx renders React Flow <Controls /> (zoom/fit buttons). The library styles them via .react-flow__controls-button (specificity 0,1,0), which LOSES background-color/box-shadow/color to Obsidian's app-wide button:not(.clickable-icon) rule (0,1,1) — the same specificity trap fixed for the plugin's own buttons in nid_zine3xz9xp8a04vn8v0bezakz_e (see src/view/graph-view.css comments and e2e/vicinityGraph.e2e.ts chrome assertions). The plugin sets --xy-controls-button-* variables in src/view/graph-view.css (~line 29), but those variables only take effect through the library rule that is being out-specified.

Fix idea: add a higher-specificity override in src/view/graph-view.css, e.g. `.vicinity-graph-flow .react-flow__controls-button { background-color: var(--xy-controls-button-background-color); ... }`, plus an e2e computed-style assertion (probe-element pattern in e2e/vicinityGraph.e2e.ts, buttonChromeVsDeclared).

FIRST verify in real Obsidian (npm run test:e2e or the dev vault) that the controls actually render wrong — the library may inject its CSS later or with different selectors.

## Resolution (2026-08-01)

**Confirmed real in real Obsidian.** A new e2e chrome assertion ("React Flow zoom controls keep their themed chrome…" in `e2e/vicinityGraph.e2e.ts`, probe-element `buttonChromeVsDeclared` pattern) failed before the fix: the buttons carried Obsidian's raised `--input-shadow` box-shadow instead of `none`. Background happened to MATCH only because the default theme's `--interactive-normal` resolves to the same color as `--background-primary` — the shadow was the reliable differentiator, and height/padding/border-radius were also being out-specified (Obsidian's `button:not(.clickable-icon)` at 0,1,1 beats the library's `.react-flow__controls-button` at 0,1,0 for every shared property).

**Fix:** `src/view/graph-view.css` — added a `.vicinity-graph-flow .react-flow__controls-button` override block (0,2,0) re-declaring the library's button chrome (height 26px, padding 4px, border-bottom separator, radius 0, box-shadow none) with color/background routed through the existing `--xy-controls-button-*` variables so the theme mapping stays declared in ONE place, plus `:hover` and `:last-child` companions. Comment in CSS marks the prefix LOAD-BEARING, same as the attachment-chip / pin-button / stepper resets.

**Verified:** `npm run test:e2e -- vicinityGraph.e2e.ts` 25/25 passed after the fix (failing-first before it); `npm test` 1462 passed; `npm run check` clean.
