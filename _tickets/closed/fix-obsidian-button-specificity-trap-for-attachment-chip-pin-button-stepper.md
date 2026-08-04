---
closed_iso: 2026-08-01T05:39:03Z
id: nid_zine3xz9xp8a04vn8v0bezakz_e
title: Fix Obsidian button-specificity trap for attachment chip, pin button, stepper
status: closed
deps: []
links: []
created_iso: '2026-07-31T18:35:22Z'
status_updated_iso: 2026-08-01T05:39:03Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
(FIRST analyze whether the fix is right)


Obsidian paints every plain button via `button:not(.clickable-icon)` (specificity 0,1,1): background-color: var(--interactive-normal); box-shadow: var(--input-shadow); color: var(--text-color). Any plugin reset written as a SINGLE class (0,1,0) silently LOSES those three properties in the real app (invisible in unit tests; only real-Obsidian e2e can see it).

The in-node outline had exactly this bug (nid_sg4wqt2n7iphzvu3c83q4rota_e) — fixed by prefixing the ancestor class in src/view/node-outline.css, guarded by the "outline entries render as flat tree rows" assertion in e2e/nodeOutline.e2e.ts.

Still affected (all in src/view/graph-view.css, single-class selectors that set background/box-shadow/color):
- .vicinity-graph-attachment (visible: the attachment chip renders with Obsidian raised-button chrome, not var(--background-secondary))
- .vicinity-graph-pin-button (background-primary/shadow-s both lose)
- .vicinity-graph-stepper__button (audit)
- Audit ALL other plain <button> styling in src/view/*.css for the same trap.

Fix pattern: prefix an ancestor class (e.g. .vicinity-graph-node .vicinity-graph-attachment) to reach (0,2,0) > (0,1,1); add e2e computed-style assertions like the outline one.

## Resolution (2026-08-01, closed)

Analysis confirmed the ticket was right: all three named selectors were single-class (0,1,0) resets on plain `<button>`s. A failing e2e proved it first — the attachment chip's computed style in real Obsidian was `rgb(255,255,255)` + the full `--input-shadow` stack instead of `var(--background-secondary)` + `none`.

**Fixed in `src/view/graph-view.css`** (ancestor-prefix to (0,2,0), incl. `:hover`/`:focus-visible` so they also beat Obsidian's `button:not(.clickable-icon):hover` (0,2,1)):
- `.vicinity-graph-node .vicinity-graph-attachment`
- `.vicinity-graph-node .vicinity-graph-pin-button` — the `@container` reveal rule was prefixed too (a lower-specificity `display: inline-flex` would otherwise lose to the base `display: none` and the button would never show)
- `.vicinity-graph-stepper__control .vicinity-graph-stepper__button`

**Audit found 3 more in `src/view/link-preview.css`** — the `all: unset` buttons lose the same cascade fight per-property (`all: unset` at (0,1,0) does not beat (0,1,1)). Prefixed: `.vicinity-graph-link-preview-drawer .…__close`, `.vicinity-graph-link-preview .…__row-toggle`, `.vicinity-graph-link-preview .…__go`. Clean elsewhere: `settings-tab.css` styles no plugin buttons; `.vicinity-graph-section-restore` keeps Obsidian chrome on purpose; `segmented-control.css` uses radios; outline entry already fixed.

**Guards added** in `e2e/vicinityGraph.e2e.ts`: three computed-style tests (chip, pin button, stepper button) using a probe-element helper (`buttonChromeVsDeclared`) that resolves the DECLARED `var(...)` values at the same element, so assertions are theme-variable-based, not hardcoded rgb().

**Verified**: new e2e tests failed pre-fix for the predicted reason, pass post-fix; full `vicinityGraph.e2e.ts` (24), `nodeOutline.e2e.ts` + `controlsRestart.e2e.ts` + `pinnedCentralScenario.e2e.ts` (19), `npm test` (1462), `npm run check` all green.

**Follow-ups filed**:
- nid_m82om4ibnj0ouggbpenicdkce_e — React Flow `<Controls />` buttons (`.react-flow__controls-button`, library CSS at (0,1,0)) likely have the same trap; out of scope here (not `src/view/*.css`).
- nid_gytdn8nwjno1737meyrdxjxoh_e — no e2e opens the link-preview drawer, so its three fixed buttons ship chrome-unasserted; add drawer e2e with the same probe assertions.
