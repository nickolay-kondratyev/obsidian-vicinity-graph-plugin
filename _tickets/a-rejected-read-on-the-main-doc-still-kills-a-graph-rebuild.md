---
closed_iso: 2026-08-05T02:42:34Z
id: nid_iqna8b4j5339pjiga7kgwdnh7_e
title: a rejected read on the MAIN doc still kills a graph rebuild
status: closed
deps: []
links: [nid_gbyqsuplz8b7pv0u5k34sdz1q_e]
created_iso: '2026-08-04T01:58:22Z'
status_updated_iso: 2026-08-05T02:42:34Z
type: bug
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [persistence, view]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
`VicinityGraphBuilder.build` (src/adapters/VicinityGraphBuilder.ts) resolves the MAIN
doc's identity with `await this.docIdPort.getDocId(mainFile)` right after
`vault.getFileByPath(mainPath)` returned non-null. obsidian-id-lib resolves an id by
reading file CONTENT (`vault.cachedRead`), which REJECTS when the file went away
between the index lookup and the read.

That rejection propagates out of `build()`. `GraphViewController.runRebuild()`
(src/view/GraphViewController.ts, `await this.graphBuilder.build(mainPath)`) has no
try/catch and every caller does `void this.runRebuild()` — so the rejection is an
unhandled promise rejection and the view simply never publishes a snapshot for that
rebuild.

This is the SAME failure class that ticket nid_gbyqsuplz8b7pv0u5k34sdz1q_e fixed inside
`DocIdMapWarmer` (a read failure mid-scan must not kill the build). The warm-up path is
now tolerant; this sibling call one line above it is not. Impact is smaller (the main
doc vanishing is normally followed by an active-file-change event that rebuilds again),
which is why it is filed rather than patched inline.

Needs a DECISION on view-level failure policy first: does a failed rebuild leave the
previous graph on screen silently, publish the empty snapshot, or surface a notice
(`UserNoticePort`)? Pick ONE and put it in `runRebuild` — a bare catch that swallows is
not acceptable.

--------------------------------------------------------------------------------
HUMAN QUESTION: IF we failed to build can we AUTO try again? OR is it not going to work? I am thinking one retry and then we put a manual error in the graph view, with a button to try to rerender the graph again. 

ANSWER: yes, a retry works and is the right move. A rebuild pass re-reads live
Obsidian state from scratch, so the second attempt either succeeds (the read lost
a transient race) or reaches a DEFINITE answer — a main doc that is really gone no
longer resolves in `vault.getFileByPath`, so `build()` returns `null` and the view
settles EMPTY rather than failing. Implemented exactly as proposed.

## Acceptance Criteria

A rebuild whose main-doc identity read REJECTS does not produce an unhandled rejection, and the view follows one DECLARED failure policy (covered by a controller test over a fake GraphSourcePort that rejects).

## Resolution (2026-08-04)

DECLARED policy, in `GraphViewController.attemptBuildAndPublish` — ONE rule for
every failure cause and every prior screen:

1. A rejected pass is retried ONCE automatically (`REBUILD_ATTEMPTS = 2`),
   immediately — no timer to cancel, and the latest-wins `rebuildToken` still
   drops a SUPERSEDED attempt (which is neither retried nor reported: its
   successor owns the screen).
2. When the retry is also spent, the view publishes the new `failed` status
   (`FlowStatus` gained `"failed"`), reporting each attempt to the console.
3. `VicinityGraphFlow` renders that status as "Could not build the vicinity graph
   for the active file." plus a **Try again** button wired to the new
   `GraphViewController.retryRebuild()` — the only way back into the pipeline
   short of a vault/settings event. That retry shows the "Building…" placeholder
   so the button does not read as dead.

Deliberate behavior CHANGE (supersedes the previous "keep the rendered graph on a
failed rebuild" test): a rendered graph is NOT kept behind a failure. It predates
the vault state the failed pass tried to read, so leaving it up would pass a stale
graph off as current. `reset()` and the failed outcome share `clearRenderedGraph()`
so no structural-diff baseline survives a screen that shows no graph.

Covered by `GraphViewController.test.ts` → "GraphViewController rebuild failure
policy" (9 tests: auto-retry happens, retry success renders, no third attempt,
failed replaces a rendered graph, superseded builds neither retry nor publish
failed, manual retry runs / shows the placeholder / renders), plus
`VicinityGraphFlow.component.test.tsx` for the RENDERED half — the controller
tests prove `retryRebuild()` works, not that the pane ever offers it, and that
button is the user's only way back in. `npm test` (1620), `npm run check`, and
`npm run test:e2e -- vicinityGraph.e2e.ts` (25) all green.
