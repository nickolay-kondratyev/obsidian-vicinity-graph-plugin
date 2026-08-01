---
id: nid_m82om4ibnj0ouggbpenicdkce_e
title: "React Flow Controls buttons likely lose their chrome to Obsidian's button rule"
status: open
deps: []
links: []
created_iso: 2026-08-01T05:38:24Z
status_updated_iso: 2026-08-01T05:38:24Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
---

src/view/VicinityGraphFlow.tsx renders React Flow <Controls /> (zoom/fit buttons). The library styles them via .react-flow__controls-button (specificity 0,1,0), which LOSES background-color/box-shadow/color to Obsidian's app-wide button:not(.clickable-icon) rule (0,1,1) — the same specificity trap fixed for the plugin's own buttons in nid_zine3xz9xp8a04vn8v0bezakz_e (see src/view/graph-view.css comments and e2e/vicinityGraph.e2e.ts chrome assertions). The plugin sets --xy-controls-button-* variables in src/view/graph-view.css (~line 29), but those variables only take effect through the library rule that is being out-specified.

Fix idea: add a higher-specificity override in src/view/graph-view.css, e.g. `.vicinity-graph-flow .react-flow__controls-button { background-color: var(--xy-controls-button-background-color); ... }`, plus an e2e computed-style assertion (probe-element pattern in e2e/vicinityGraph.e2e.ts, buttonChromeVsDeclared).

FIRST verify in real Obsidian (npm run test:e2e or the dev vault) that the controls actually render wrong — the library may inject its CSS later or with different selectors.

