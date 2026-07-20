# Ticket: e2e node-open click unreliable in headless

**Status:** OPEN — pre-existing; isolated during step-06 e2e work.
**Scope:** test-infra only (no product defect).

## Observation

`e2e/neighborhoodGraph.e2e.ts` › "clicking a node opens that note in the current
tab" (and the ctrl/cmd-click test after it) fails under headless Obsidian
(`OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"`): after
`remountGraphView()`, a real pointer `noteNode("note2.md").click()` does not open
note2 (active file stays note1). The click lands but the note never activates.

## Not a regression (verified)

Reproduced on the **unchanged** `main` harness (stash the step-06 harness edits →
same failure), so it is independent of the step-06 e2e additions. It likely passes
in the original author's non-headless environment (the step-05 ticket recorded it
green there).

## Likely cause

`note2`'s node, in note1's ~11-node graph, lands after `fitView` at a position
where the headless click resolves to a covering element / empty pane rather than
the node's open handler. The step-06 specs sidestep this class of issue with
SPARSE, ROOT-level fixtures (`pinnedCentralScenario` / `controlsRestart`), where
`fitView` keeps nodes large and unobstructed — the node PIN pointer-click there is
reliable.

## Options

- Make the click test robust the same way (sparse fixture or assert on a node
  guaranteed clear of groups/panel), OR scroll/pan the target to center before
  clicking.
- Or gate the two pointer-open tests behind a non-headless capability check.

Do NOT weaken the assertion; the behavior (click opens the note) is correct and
must stay covered.
