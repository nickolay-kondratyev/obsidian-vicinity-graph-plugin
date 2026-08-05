---
id: nid_iqna8b4j5339pjiga7kgwdnh7_e
title: a rejected read on the MAIN doc still kills a graph rebuild
status: in_progress
deps: []
links: [nid_gbyqsuplz8b7pv0u5k34sdz1q_e]
created_iso: '2026-08-04T01:58:22Z'
status_updated_iso: '2026-08-05T02:38:13Z'
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

## Acceptance Criteria

A rebuild whose main-doc identity read REJECTS does not produce an unhandled rejection, and the view follows one DECLARED failure policy (covered by a controller test over a fake GraphSourcePort that rejects).
