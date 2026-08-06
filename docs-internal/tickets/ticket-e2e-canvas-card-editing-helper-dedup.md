# Ticket: Extract a shared canvas-card editing helper for the two canvas e2e specs

**Status:** OPEN
**Origin:** Adversarial review of `coreEditingWhileGraphOpen.e2e.ts` (ticket
`nid_5f1o7z2iyis3sgbbpeu7j8oor_e`). The new spec is correct and green; this is a
long-term DRY concern, not a bug.

`e2e/canvasSpaceKey.e2e.ts` and `e2e/coreEditingWhileGraphOpen.e2e.ts` now duplicate
the same canvas knowledge:

- The `app.workspace.getLeavesOfType("canvas")[0].view.canvas.createTextNode({...})`
  incantation (inlined in the former, `createCanvasTextNode` in the latter).
- Reaching the focused card's `.cm-content` through `page.frameLocator(".canvas-node
  iframe")`.
- The multi-line WHY comment about controlled-iframe keystroke forwarding being the
  condition that makes the React Flow key-grab bug possible — written verbatim in both
  files (the exact "same WHY comment twice" DRY smell).

The broader spec (`coreEditingWhileGraphOpen`, test 1) already asserts Space **and**
Shift survive in a canvas card, fully superseding `canvasSpaceKey`'s single Space
assertion.

Fix (touches a pre-existing file, hence deferred out of the review): move the canvas
helpers into a shared `e2e/canvasCardEditing.ts` module (mirroring existing helper
modules like `e2e/nodeContentBox.ts`, `e2e/buttonChrome.ts`), with the WHY comment
stated ONCE, and have both specs import it. Then decide whether `canvasSpaceKey.e2e.ts`
should fold into `coreEditingWhileGraphOpen.e2e.ts` outright — its assertion is now a
strict subset. Re-run `npm run test:e2e -- canvasSpaceKey coreEditingWhileGraphOpen`
after, since these are canvas pointer/iframe specs `npm test` cannot reach.
