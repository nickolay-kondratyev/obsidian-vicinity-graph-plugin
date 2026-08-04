---
id: nid_y081nezeucka9l0x3umebi5zo_e
title: "first graph build after restart can block on a full-vault content scan"
status: open
deps: []
links: [nid_gbyqsuplz8b7pv0u5k34sdz1q_e]
created_iso: 2026-08-04T01:39:54Z
status_updated_iso: 2026-08-04T01:39:54Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [persistence, perf]
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