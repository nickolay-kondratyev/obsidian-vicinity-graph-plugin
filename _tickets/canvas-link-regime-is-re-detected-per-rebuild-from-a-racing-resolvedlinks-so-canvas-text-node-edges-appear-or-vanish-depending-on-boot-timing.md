---
closed_iso: 2026-07-27T20:22:56Z
id: nid_s676x55uojmtcwh9t4l9mc6zl_e
title: "Canvas link regime is re-detected per rebuild from a racing resolvedLinks, so canvas text-node edges appear or vanish depending on boot timing"
status: closed
deps: []
links: [nid_li45606h8uvcnjm7fss17xl1u_e, nid_ygo7h95ssgmunaqsprc1zlmfh_e]
created_iso: 2026-07-26T05:58:40Z
status_updated_iso: 2026-07-27T20:22:56Z
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

HUMAN DECISION: "Should a wikilink written inside a canvas TEXT node produce a graph edge" -> YES we want to have support for Canvas and a wiki link inside a node in canvas (AS Long as performance for this approach holds). 

## Candidate fixes

1. **Detect capability once, late.** Detect at plugin load, after the first `metadataCache "resolved"` event, and cache it on a collaborator injected into `VicinityGraphBuilder` instead of re-detecting per `build()`. Cheap, removes the race, but freezes a decision made from one snapshot (a vault whose only canvas file is created later would stay on the fallback).
2. **Unify the two regimes.** Make both link sources yield the SAME edge set for a canvas (per the product answer above), so which one wins stops mattering. More work, but the race becomes benign by construction and the two code paths stop being able to disagree.

Option 2 is the durable one; option 1 is the 80/20 stopgap. Recommend deciding the product question first, since option 2 depends on it.
Human Decision: Yes option 2 sounds more aligned with canvas support 

## Note on scope

Do NOT change the edge semantics without the human decision recorded here — both numbers are currently shipped, so either choice is a user-visible behaviour change.

## Acceptance Criteria

- The canvas link regime no longer varies between sessions for the same vault (repeat the 5x e2e measurement above and get one capability / one edge count).
- The chosen text-node-wikilink semantics are recorded in `docs-internal/plan/high-level-plan.md` and covered by an adapter test in `src/adapters/ObsidianLinkProvider.test.ts` for BOTH regimes.
- `src/adapters/CanvasFallbackParser.ts` header no longer describes a V1 skip that contradicts the shipped behaviour.
- The e2e eval row is re-baselined and its now-vestigial workaround removed: with the regime pinned in the
  plugin, `ensureCanvasFixtureIsIndexed()` in `e2e/edgeRoutingEval.e2e.ts` exists only to force
  `core-indexed`, so delete it and update the expected `[eval] force/sparse` edge count (11 today under
  `core-indexed`; 10 if the decision is that text-node wikilinks produce no edge).


## Notes

**2026-07-27T20:22:56Z**

RESOLVED on branch `canvas-link-regime-unify` (commits 621ece9, 42076cb, 72ba519, bbdebf0).

Human decisions applied as recorded: canvas TEXT-node wikilinks DO produce edges, fixed via
option 2 (unify the regimes) rather than option 1 (detect-once caching).

What changed:
- `src/adapters/CanvasFallbackParser.ts` now harvests wikilinks (`[[x]]` and `![[x]]`) from canvas
  TEXT-node bodies via the new `src/shared/Wikilinks.ts`; resolution goes through the existing
  `MetadataCachePort.getFirstLinkpathDest`, mirroring the markdown flow. No port change was needed.
- The regime is now decided PER CANVAS, not per install: `CanvasCapabilityDetector.detect(keys)`
  collapsed into `detectFor(resolvedLinks, canvasPath)` (exact key lookup). This fixed a second,
  worse instance of the same class of bug found in review: with a vault-wide verdict, a vault where
  Obsidian had indexed one canvas but not another lost ALL edges for the unindexed canvas. The
  `canvasCapability` field is gone — regime state IS `canvasOutgoingByPath` membership, so
  `getLinkCount`/`outgoingPathsOf` lost branches rather than gaining them. The old `my.canvas.md`
  suffix false positive is gone too.
- Text-node scanning sits inside the mtime-keyed `CanvasParseCache`, so the per-build cost is
  unchanged (verified by code reading in review, per the human's "as long as performance holds").
- Docs: `docs-internal/plan/high-level-plan.md` `### Canvas support` records the settled semantics;
  the `Deferred to V2+` line for canvas text-node wikilink parsing is gone. The
  `CanvasFallbackParser.ts` header no longer claims a V1 skip. Stale `"skipped in V1"` fixture text
  in `scripts/setup-dev-vault.sh` updated.
- e2e: `ensureCanvasFixtureIsIndexed()` deleted from `e2e/edgeRoutingEval.e2e.ts` (vestigial once the
  regime is pinned). A second dev-vault canvas (`test2.canvas`, depth 2 from note1 so no existing
  baseline moved) guards the partial-index case.

Verification:
- 5x `npm run test:e2e -- edgeRoutingEval.e2e.ts` → 11 edges in all 5 runs (was 10/11 coin flip).
  Stronger: 4 instrumented probe runs landed on BOTH regimes and still produced 11, so the boot race
  is benign by construction rather than merely hidden.
- `npm test` 1082 passed / 80 files; `npm run check` clean; `vicinityGraph.e2e.ts` 21 passed.

Known residual, deliberately deferred to `nid_ygo7h95ssgmunaqsprc1zlmfh_e`: markdown-style
`[a](b.md)` links in text nodes (core indexes them, fallback does not) and `[[links]]` inside code
spans (core skips them, fallback harvests them). Both documented in code and in the plan doc.

Edge ORDER still differs between regimes (core's order is not ours). Verified in review that order
does NOT feed truncation or top-N selection — `NodePriorityChain` ends in a total lexicographic path
order and `GraphStructureDiff` compares Sets — so this is not user-visible. The ticket's criterion
is the edge SET.
