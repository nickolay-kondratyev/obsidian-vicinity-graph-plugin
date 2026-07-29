# Ticket: headless e2e — React Flow culling UNMOUNTS the MAIN node seconds after mount

**Status:** OPEN — environment/harness flake. **Not** a product bug; the plugin renders correctly.
**Origin:** `node-content-preference` wave C (Phase 5). Hit while adding e2e cases to
`e2e/nodeOutline.e2e.ts` and diagnosed there with a throwaway probe spec.

**Attribution — what was actually verified, and by whom.** Wave C's own re-runs were on a
`git stash` of commit `c96640d` (the wave **B** tip), i.e. waves A+B were still applied —
so they exonerated wave C only, **not** the feature branch. The IMPLEMENTATION_REVIEWER
then ran the missing experiment from a `git worktree` on **true `main`** and confirmed the
flake reproduces there, so the feature branch genuinely does not cause it. The reviewer
also isolated the trigger: it appears only when the dev vault carries a saved
`.obsidian/workspace.json` (see below).

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

## The trigger: a saved `.dev-vault/.obsidian/workspace.json`

`ObsidianHarness.prepareVaultCopy()` copies `.dev-vault` wholesale, `workspace.json`
included, so Obsidian restores that vault's SAVED pane geometry instead of laying out
fresh. In a headless window that geometry yields a small graph pane, which is what lets the
later layout pass push the MAIN node out of view. Measured (reviewer, then reproduced by
IMPLEMENTATION_ITERATION round 1):

| Dev vault state | `:92` result |
|---|---|
| **no** saved `workspace.json` | passes (reviewer 5/5 on `main`; round 1: 3/3 on the branch, plus a full-suite run) |
| **with** the saved `workspace.json` | fails, and the serial file reports "13 did not run" |

So `mv .dev-vault/.obsidian/workspace.json` aside is the **workaround** for getting an
informative run out of `nodeOutline.e2e.ts` today — it is not the fix.

**UPDATE (ticket `nid_0jzq3ev878kjd0zhn3zxyje8q_e`):** that manual `mv` is now permanent
and automatic — `prepareVaultCopy()` deletes `<copy>/.obsidian/workspace.json` after the
`cpSync`, so EVERY run boots on Obsidian's default layout regardless of what a human left
in `.dev-vault`. The trigger above can therefore no longer fire from the dev vault. The
underlying fragility (a later layout pass pushes the MAIN node out of a small pane and
culling unmounts it, with `fitView` running on mount only) is untouched — this ticket stays
open for that.

Whether a test passes is therefore a pure race between Playwright's first assertion and
that later layout pass, biased by the restored pane geometry. The very first run in a fresh
container passed 11/11 in 2.8s; four consecutive later runs all failed.

## Workaround in place (do not mistake it for the fix)

The E8 cases added by `node-content-preference`, plus E7, go through a local helper,
`showNoteWithRefitGraph()` in `e2e/nodeOutline.e2e.ts`, which calls the existing
`ObsidianHarness.remountGraphView()` after `openFile` — remounting re-runs `fitView`
on the CURRENT (settled) positions. It is a real user action (reopen the view), and it
changes no assertion. The other pre-existing cases in that file were deliberately left
untouched, so the file still goes red in this environment (when `workspace.json` is saved).

## Do this

1. Decide where the fix belongs. Candidates, cheapest first:
   - `ObsidianHarness.openGraphView()` waits for layout to settle and then re-fits
     (one place, fixes every spec at once);
   - a `fitView` on `layoutVersion` change in `VicinityGraphFlow.tsx` — a **product**
     change, so it needs its own decision (it would also move the user's viewport);
   - `onlyRenderVisibleElements={false}` in the e2e build only — rejected on sight if it
     means shipping a test-only code path.
2. Whatever is chosen, prove it by running `npm run test:e2e -- nodeOutline.e2e.ts`
   **five times in a row** on the same machine, **with** a saved `workspace.json` in
   `.dev-vault` — a single green run, or a run without that file, proves nothing here.
   Run the WHOLE file, never `--grep`: in a serial file `--grep` removes exactly the
   neighbours whose state coupling you need to observe.
3. Then trim `showNoteWithRefitGraph()`'s reason **2** (the refit) — but KEEP the helper
   and its reason **1**: E7 and E8.3 depend on it for an EXPLICIT rebuild after a
   store-only write, which has nothing to do with this flake. Deleting it outright would
   re-introduce the cross-test coupling that made E7 fail in wave C.

## Environment where this was measured

Linux container, no display server, so `scripts/run-e2e.sh` supplies
`--ozone-platform=headless --disable-gpu`; Obsidian 1.12.7 auto-provisioned into
`.tmp/obsidian/`; `workers: 1`, `retries: 0` (`e2e/playwright.config.ts`).
