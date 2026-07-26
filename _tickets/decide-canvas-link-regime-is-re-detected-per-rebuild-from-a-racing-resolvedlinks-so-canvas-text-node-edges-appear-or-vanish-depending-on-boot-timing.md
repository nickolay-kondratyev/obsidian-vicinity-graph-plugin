---
id: nid_s676x55uojmtcwh9t4l9mc6zl_e
title: "[decide] Canvas link regime is re-detected per rebuild from a racing resolvedLinks, so canvas text-node edges appear or vanish depending on boot timing"
status: open
deps: []
links: [nid_li45606h8uvcnjm7fss17xl1u_e]
created_iso: 2026-07-26T05:58:40Z
status_updated_iso: 2026-07-26T05:58:40Z
type: bug
priority: 2
assignee: CC_WITH-nickolaykondratyev
---

## What happens

The plugin decides, ON EVERY GRAPH REBUILD, where canvas outgoing links come from:

- `src/adapters/VicinityGraphBuilder.ts` `build()` constructs a NEW `ObsidianLinkProvider` per rebuild (`await ObsidianLinkProvider.create(...)`).
- `src/adapters/ObsidianLinkProvider.ts` `create()` calls `CanvasCapabilityDetector.detect(Object.keys(metadataCache.resolvedLinks))`.
- `src/adapters/CanvasCapability.ts` returns `core-indexed` iff SOME key in `resolvedLinks` already ends with `.canvas`, else `fallback-required`.

Those two regimes do NOT produce the same edge set:

- `core-indexed` -> canvas links come from Obsidian core `resolvedLinks`, which INCLUDES wikilinks written inside canvas TEXT nodes.
- `fallback-required` -> canvas links come from `src/adapters/CanvasFallbackParser.ts`, which parses FILE-type canvas nodes only and deliberately skips text-node wikilinks (documented as V1 scope in that file header).

`resolvedLinks` is filled asynchronously at vault boot, so which regime a rebuild lands in is a race. A user who opens the graph early sees one graph; a rebuild a few seconds later can silently produce a different one.

## Measured evidence (real Obsidian 1.12.7, `.dev-vault`)

Instrumented `VicinityGraphBuilder.build()` to log the detected capability next to the built edge count, then ran `npm run test:e2e -- edgeRoutingEval.e2e.ts` 5x. Perfect 5/5 correlation on the `note1.md` vicinity (`test.canvas` has file nodes `note1.md` + `note3.md` and one TEXT node containing `[[note2]]`):

| run | detected capability | flow edges |
|-----|--------------------|------------|
| 1 | fallback-required | 10 |
| 2 | core-indexed | 11 |
| 3 | core-indexed | 11 |
| 4 | fallback-required | 10 |
| 5 | fallback-required | 10 |

The single differing edge is `test.canvas -> note2.md` (the canvas text-node wikilink). Node/obstacle count is 13 either way. Within any one run all rebuilds agreed on the capability, so this is a per-SESSION boot race, not an intra-session flip.

## Reproduction

1. `npm run setup:dev-vault`
2. Add `console.debug` of `provider.canvasCapability` in `src/adapters/VicinityGraphBuilder.ts` `build()`.
3. `npm run test:e2e -- edgeRoutingEval.e2e.ts` repeatedly and read the `[eval] force/sparse:` line: `edges=` alternates 10 / 11 with the capability.

Originating e2e chore: ticket `nid_li45606h8uvcnjm7fss17xl1u_e` (`_tickets/e2e-sparse-eval-fixture-flips-between-10-and-11-edges-run-to-run.md`). That chore fixed the HARNESS only (it now waits for the canvas index before measuring); the product behaviour below is untouched and needs a human decision.

## Design

## The decision needed (product, not mechanical)

Should a wikilink written inside a canvas TEXT node produce a graph edge?

- YES -> `core-indexed` is the intended behaviour; the fallback parser is under-reporting and should learn to scan text-node bodies for wikilinks.
- NO -> the fallback (V1 scope, `src/adapters/CanvasFallbackParser.ts` header) is intended; the core-indexed path is over-reporting and should filter text-node-sourced links.

Either way the SECOND half of the fix is the same and is not a product question: the regime must stop being a coin flip.

## Candidate fixes

1. **Detect capability once, late.** Detect at plugin load, after the first `metadataCache "resolved"` event, and cache it on a collaborator injected into `VicinityGraphBuilder` instead of re-detecting per `build()`. Cheap, removes the race, but freezes a decision made from one snapshot (a vault whose only canvas file is created later would stay on the fallback).
2. **Unify the two regimes.** Make both link sources yield the SAME edge set for a canvas (per the product answer above), so which one wins stops mattering. More work, but the race becomes benign by construction and the two code paths stop being able to disagree.

Option 2 is the durable one; option 1 is the 80/20 stopgap. Recommend deciding the product question first, since option 2 depends on it.

## Note on scope

Do NOT change the edge semantics without the human decision recorded here — both numbers are currently shipped, so either choice is a user-visible behaviour change.

## Acceptance Criteria

- The canvas link regime no longer varies between sessions for the same vault (repeat the 5x e2e measurement above and get one capability / one edge count).
- The chosen text-node-wikilink semantics are recorded in `docs-internal/plan/high-level-plan.md` and covered by an adapter test in `src/adapters/ObsidianLinkProvider.test.ts` for BOTH regimes.
- `src/adapters/CanvasFallbackParser.ts` header no longer describes a V1 skip that contradicts the shipped behaviour.

