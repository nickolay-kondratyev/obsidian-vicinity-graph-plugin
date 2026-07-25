# Ticket: headless e2e — React Flow culling UNMOUNTS the MAIN node seconds after mount

**Status:** OPEN — environment/harness flake. **Not** a product bug; the plugin renders correctly.
**Origin:** `node-content-preference` wave C (Phase 5). Hit while adding e2e cases to
`e2e/nodeOutline.e2e.ts`; diagnosed with a throwaway probe spec, then reproduced on a
**pristine `main`** tree, so nothing in that feature branch causes it.

## Symptom

`e2e/nodeOutline.e2e.ts`'s FIRST case
(`the outline lists its headings as stripped labels in document order`) fails with

```
Locator: locator('.vicinity-graph-node[data-path="outline-note.md"]').locator('.vicinity-graph-outline')
Expected: visible ... Error: element(s) not found
```

Because the file is `test.describe.configure({ mode: "serial" })`, the remaining
cases then report **"did not run"** — one flake hides the whole file.

Other cases in the suite that click or read a specific node are exposed to the same
failure mode; see the sibling tickets
`docs-internal/tickets/ticket-e2e-node-click-flaky-headless.md`,
`docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md` and
`docs-internal/tickets/ticket-viewport-culling-visual-smoke.md`.

## Measured root cause (probe evidence, not a guess)

A throwaway spec sampled the DOM every 1.5s after `openFile("outline-note.md")` +
`openGraphView()` in the headless harness:

```
t0    nodes=["outline-note.md:main:outline", "outline-cover.md:regular:thumbnail"]  nodeHeight=160
t1500 nodes=["outline-cover.md:regular:thumbnail"]                                  (outline-note GONE)
t3000 … t6000  same — it never comes back
```

The metadata cache is fine throughout (`headings.length = 13`, `cache !== null`) and the
plugin's controller is alive. So:

- the graph data and the preview decision are **correct** — at `t0` the node is
  `data-tier="main"`, `data-preview="outline"`, 160px tall;
- a LATER layout pass (force refinement / edge routing settling) moves the MAIN node
  outside the visible pane;
- React Flow's `onlyRenderVisibleElements` culling then **unmounts** it, and
  `fitView` does not re-run because it only runs on MOUNT.

Whether a test passes is therefore a pure race between Playwright's first assertion and
that later layout pass. The very first run in a fresh container passed 11/11 in 2.8s;
four consecutive later runs (two of them on a stashed, pristine tree) all failed.

## Workaround in place (do not mistake it for the fix)

The three cases added by `node-content-preference` go through a local helper,
`showNoteWithRefitGraph()` in `e2e/nodeOutline.e2e.ts`, which calls the existing
`ObsidianHarness.remountGraphView()` after `openFile` — remounting re-runs `fitView`
on the CURRENT (settled) positions. It is a real user action (reopen the view), and it
changes no assertion. The **pre-existing** cases in that file were deliberately left
untouched, so the file still goes red in this environment.

## Do this

1. Decide where the fix belongs. Candidates, cheapest first:
   - `ObsidianHarness.openGraphView()` waits for layout to settle and then re-fits
     (one place, fixes every spec at once);
   - a `fitView` on `layoutVersion` change in `VicinityGraphFlow.tsx` — a **product**
     change, so it needs its own decision (it would also move the user's viewport);
   - `onlyRenderVisibleElements={false}` in the e2e build only — rejected on sight if it
     means shipping a test-only code path.
2. Whatever is chosen, prove it by running `npm run test:e2e -- nodeOutline.e2e.ts`
   **five times in a row** on the same machine — a single green run proves nothing here.
3. Then delete `showNoteWithRefitGraph()` and its WHY comment.

## Environment where this was measured

Linux container, no display server, so `scripts/run-e2e.sh` supplies
`--ozone-platform=headless --disable-gpu`; Obsidian 1.12.7 auto-provisioned into
`.tmp/obsidian/`; `workers: 1`, `retries: 0` (`e2e/playwright.config.ts`).
