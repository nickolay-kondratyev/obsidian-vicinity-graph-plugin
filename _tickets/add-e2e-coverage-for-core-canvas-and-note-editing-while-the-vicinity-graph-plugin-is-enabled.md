---
id: nid_5f1o7z2iyis3sgbbpeu7j8oor_e
title: Add e2e coverage for core canvas and note editing while the vicinity graph
  plugin is enabled
status: in_progress
deps: []
links: [nid_156zg4bvhjc7nnl0gwut20bvs_e]
created_iso: '2026-08-01T18:25:40Z'
status_updated_iso: '2026-08-06T20:49:02Z'
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-3
---
The vicinity graph view mounts React Flow, which installs WINDOW/DOCUMENT-level key handlers; ticket nid_156zg4bvhjc7nnl0gwut20bvs_e showed it eating Space inside core canvas text nodes app-wide (root cause: RF default panActivationKeyCode=Space preventDefault()s forwarded keystrokes from Obsidian's controlled embed iframes; fixed by nulling deleteKeyCode/selectionKeyCode/panActivationKeyCode/zoomActivationKeyCode in src/view/VicinityGraphFlow.tsx, gated by e2e/canvasSpaceKey.e2e.ts).

Follow-up: broaden e2e coverage so CORE functionality keeps working while the plugin is enabled, beyond the single Space/canvas case:
- Canvas: typing all of Space/Shift+chars/Backspace into a canvas text node; deleting a selected canvas node with Backspace/Delete still works (RF deleteKeyCode must not grab it); creating/editing node after NAVIGATING to the canvas while the vicinity view is open (the original repro emphasized the navigation step).
- Markdown note editing in the main pane with the vicinity view open: Space, Backspace, Shift-typing.
- Consider a generic guard: assert no window/document keydown listener calls preventDefault() for plain typing keys while the vicinity view is mounted.

Build on e2e/canvasSpaceKey.e2e.ts (canvas card creation recipe via canvas.createTextNode + frameLocator into the controlled embed iframe) and e2e/obsidianHarness.ts.

## Acceptance Criteria

npm run test:e2e passes with new specs covering: canvas text-node typing (Space/Backspace/Shift), canvas node deletion, and markdown note typing — all while the vicinity graph view is open and rendering a non-empty graph.
