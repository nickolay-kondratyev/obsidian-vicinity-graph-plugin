---
closed_iso: 2026-08-06T23:14:33Z
id: nid_h55sqq8nz172mgx5etez2gd77_e
title: On initial load we should have a different message
status: closed
deps: []
links: []
created_iso: '2026-08-06T22:31:35Z'
status_updated_iso: 2026-08-06T23:14:33Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Right now we have a simple message on building the graph,
But it really shows up only on the beginning load, while making it look like it may have slow build out for the future as well.
```tsx file=[$(git.repo_root)/src/view/VicinityGraphFlow.tsx] Lines=[171-172]
		return <div className="vicinity-graph-building">Building the vicinity graph…</div>;
```

I am thinking IF and only IF **its straightforward** to detect whether obsidian just loaded and we are doing the first reload, then the message should say so so the users dont think it takes forever to load the graphs all the time. But only on the initial load, so if we can detect that its initial load and we are building the graph then we should have different message for that case.

## Resolution (closed 2026-08-06)

It WAS straightforward: the controller already tracks the exact signal. `GraphViewController.firstBuildPending` marks the ONE build of a controller's life that pays the docid warm-up — the slow, first-after-load build (ticket `nid_y081nezeucka9l0x3umebi5zo_e`). Every later build reads a warm map and returns fast, so the placeholder barely shows; and the only OTHER path that publishes a `building` placeholder is the retry off the failed state, which is not a first build. So the initial load is cleanly distinguishable without any new plugin-level lifecycle flag.

Changes:
- `src/view/GraphViewController.ts`: added `FlowSnapshot.isInitialBuild` (meaningful only while `status === "building"`). New `INITIAL_BUILDING_SNAPSHOT` (`isInitialBuild: true`) is published when `firstBuildPending`; the pre-existing `BUILDING_SNAPSHOT` (`isInitialBuild: false`) now covers ONLY the retry-off-failed path. `EMPTY_SNAPSHOT` and the ready publish carry `isInitialBuild: false`.
- `src/view/VicinityGraphFlow.tsx`: the `building` branch now picks copy by `snapshot.isInitialBuild` — initial load shows "Building the vicinity graph for the first time — this is quicker afterwards…"; every other build keeps the plain "Building the vicinity graph…".

Tests:
- `src/view/GraphViewController.test.ts`: first build flagged `isInitialBuild: true`; retry off failed flagged `false`.
- `src/view/VicinityGraphFlow.component.test.tsx`: rendered pane over the REAL controller (a never-resolving source holds the first build in flight) asserts the one-off copy; the existing retry test already pins the plain copy.

Gates: `npm run check`, `npm test` (1714 passing), and `npm run test:e2e -- vicinityGraph.e2e.ts` (27 passing) all green.
