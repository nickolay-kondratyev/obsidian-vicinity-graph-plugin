---
closed_iso: 2026-08-04T22:18:34Z
id: nid_y081nezeucka9l0x3umebi5zo_e
title: first graph build after restart can block on a full-vault content scan
status: closed
deps: []
links: [nid_gbyqsuplz8b7pv0u5k34sdz1q_e]
created_iso: '2026-08-04T01:39:54Z'
status_updated_iso: 2026-08-04T22:18:34Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [persistence, perf]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
The cold-map fix (ticket nid_gbyqsuplz8b7pv0u5k34sdz1q_e, commit 59e26b5) made
`VicinityGraphBuilder.build` AWAIT `DocIdMapWarmer.warmFor(...)` before assembling the
request (`src/adapters/VicinityGraphBuilder.ts`, `src/persistence/DocIdMapWarmer.ts`).

The scan resolves docids by calling `DocIdPort.getDocId`, and obsidian-id-lib resolves
an id by reading file CONTENT (`vault.cachedRead` — see
`node_modules/obsidian-id-lib/dist/index.js`, `FrontmatterDocIdStore.getId` /
`CanvasDocIdStore.getId`). It early-exits once every wanted docid is found, but in the
worst case (a pinned/overridden doc late in `vault.getFiles()` order, or an ORPHANED
docid that no file carries) the FIRST build after a restart reads EVERY eligible file
before the graph renders.

The scan is chunked (batch 20 with a real yield), so Obsidian stays responsive, but the
graph view shows nothing until it finishes. On a 10k-note vault that is seconds. It is
bounded — a resolved docid is mapped and an unresolvable one is cached as a per-session
miss (a walk whose READS failed forgives the miss ONCE, so the ceiling is two full scans
per unresolvable docid per session, not one) — and today it only happens when the user
HAS pins/overrides.

Directions (pick ONE, do not stack):
- (a) Resolve markdown docids from `metadataCache.getFileCache(file).frontmatter` instead
  of reading content. Nearly free, but it duplicates id-lib's frontmatter key knowledge
  in this repo and does not cover `.canvas` — would need a seam in obsidian-id-lib
  (a `getDocIdFromMetadata`-style read) to stay honest.
- (b) Do not block the build: render with what the map has, warm in the background, and
  refresh open views when the warm-up resolved anything new (the `ViewsRefreshPort`
  fan-out already exists in `src/main.ts`). Costs a second render, keeps first paint fast.
- (c) Accept it and measure first: instrument the warm scan duration on a large vault
  before changing anything.

No behavior is WRONG today — this is a first-paint latency ceiling on large vaults.

## Acceptance Criteria

On a vault with thousands of notes and at least one pinned doc, the first graph build after a restart is not visibly delayed by the docid warm-up (measured, not assumed), and pins/overrides still render correctly on the first build the user sees.

--------------------------------------------------------------------------------
HUMAN DECISION: This is only for the initial load right? I am thinking for now its acceptable to await on graph to load, It would be good to have 'loading' show up in such case. BUT only if its very straightforward and doesnt add unecessary complications. I havent found this to be an issue and I have been using it on large vaults.

--------------------------------------------------------------------------------

## Resolution (2026-08-04) — direction (c'): keep the await, tell the truth while it runs

Yes, this is the INITIAL load only (a warm map costs nothing, so later rebuilds never
scan). Per the human decision the blocking `warmFor` await stays exactly as it is —
`VicinityGraphBuilder` and `DocIdMapWarmer` are UNCHANGED, and pins/overrides therefore
still render correctly on the first build the user sees. What changed is only what the
view shows while that build is in flight.

Before, the view had two states (`empty` | `ready`) and a build in flight rendered the
EMPTY state — "No vicinity graph for the active file." That is a wrong answer to a
question still open, not a pending one.

Changes (all in `src/view/`):
- `GraphViewController.ts`: `FlowStatus` grows a third member, `building`, published from
  `runRebuild` **only while the FIRST build is in flight** (`firstBuildPending`, cleared
  once a build settles — graph, empty, or failure). The warm-up is paid once, so only that
  build can visibly wait; a later rebuild is fast and a placeholder would only flicker —
  over a live graph AND over the empty state, which rebuilds on every metadata resolve.
  A rebuild that THROWS is caught there too: it logs and, if the placeholder is up, gives
  way to the empty state (a rendered graph is kept), so a failed first build can never
  leave "Building…" standing forever.
- `VicinityGraphFlow.tsx`: renders `.vicinity-graph-building` ("Building the vicinity
  graph…") for that status; the link-preview-drawer close effect now fires on any
  not-`ready` status rather than on `empty` alone.
- `graph-view.css`: `.vicinity-graph-building` shares the centered/muted presentation of
  `.vicinity-graph-empty`; only the sentence differs.
- `GraphViewController.test.ts`: BDD tests for building while the first build is in
  flight; a rendered graph staying published across a rebuild; building giving way to
  `empty` on a no-graph result; a settled-empty pane NOT re-entering the placeholder on a
  later rebuild; and both rejection cases (placeholder → empty, rendered graph kept). One
  pre-existing latest-wins test asserted `empty` for a first build still in flight and now
  asserts `building` — same intent (the stale result was not rendered), corrected literal.

No measurement was taken and none is claimed: the human explicitly accepted the await
after using the plugin on large vaults, so the acceptance criterion's "not visibly
delayed (measured)" is superseded by that decision. Directions (a) and (b) were NOT taken
and remain available if first-paint latency ever becomes a real complaint.

Verified: `npm test` (1594 passed), `npm run check`, `npm run test:e2e -- vicinityGraph.e2e.ts`
(25 passed). The transient building state is not asserted in e2e — it is not
deterministically observable there, and asserting it would need a fake slow build.
