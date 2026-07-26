# IMPLEMENTATION_WITH_SELF_PLAN — PUBLIC

Ticket: `nid_li45606h8uvcnjm7fss17xl1u_e` — sparse eval row flips between `edges=10` and
`edges=11`. Branch `sparse-eval-edge-flake`.

## Root-cause verdict: PLUGIN-side. The harness tie-break contributed NOTHING to this flake.

Measured, not inferred. Temporary instrumentation logged the detected `CanvasCapability`
next to the built edge count on every rebuild; 5 runs of the eval spec:

| run | capability (every build in the window) | reported `edges=` | maxDetourRatio |
|-----|-----------------------------------------|-------------------|----------------|
| 1 | fallback-required | 10 | 1.000 |
| 2 | core-indexed | 11 | 1.007 |
| 3 | core-indexed | 11 | 1.007 |
| 4 | fallback-required | 10 | 1.000 |
| 5 | fallback-required | 10 | 1.000 |

**(a) The edge SET genuinely differs between runs.** The plugin re-detects its canvas link
source on every `build()` (`src/adapters/VicinityGraphBuilder.ts` →
`src/adapters/ObsidianLinkProvider.create` → `src/adapters/CanvasCapability.ts`) from
`metadataCache.resolvedLinks`. `core-indexed` reports the wikilink inside `test.canvas`'s
TEXT node (`test.canvas → note2.md`), `fallback-required` does not
(`src/adapters/CanvasFallbackParser.ts`, documented V1 scope). Obstacle count is 13 either
way. Within a run every build agreed — this is a per-SESSION divergence, not an intra-run
flip.

**(b) Exactly 3 routing passes land in the observation window**, with `obstacleCount`
3 / 4 / 13. Only ONE has the maximum, so `heaviest()` never faced a tie in any of the 5
runs. The stable-sort tie-break is a real latent hazard — fixed here — but it is not what
made the sparse row flake.

### The finding that killed the explorers' proposed harness fix

Both exploration reports suggested `page.waitForFunction` on a `.canvas` key appearing in
`resolvedLinks`. **That cannot work.** In a `fallback-required` session the key NEVER
arrives: polling 60s past a fully settled 165-key index still found none (2/2 misses). The
Canvas core plugin is enabled in those sessions (`enabled=true hasInstance=true`), so
enablement is not the discriminator, and `app.internalPlugins.enablePlugin` does not exist
on Obsidian 1.12.7.

What DOES work: rewriting the canvas file makes Obsidian index it — verified 2/2 on misses,
`canvas=0 → canvas=1` within the poll.

## What changed

### `e2e/edgeRoutingEval.e2e.ts`

1. **`ensureCanvasFixtureIsIndexed()`** (new, in `beforeAll`). If `test.canvas` is missing
   from `resolvedLinks`, rewrite it (append `\n` — a no-op for the canvas JSON, a real
   content change for Obsidian), then `page.waitForFunction` until the key is present. The
   wait is a genuine condition on observed state; the rewrite is what makes that condition
   reachable. Kept LOCAL to this spec — `e2e/obsidianHarness.ts` is untouched, and no other
   spec asserts anything canvas-edge-sensitive (`vicinityGraph.e2e.ts` counts note1 NODES,
   stable in both regimes, and edges only on the canvas-free alpha fixture).
2. **`waitForRebuildBurstToSettle()`** replaces `page.waitForTimeout(4500)`. Two required
   conditions: the CENTRAL fixture's own layout pass has been logged (it is the second of
   the burst, since `renderFixture` bounces first), and no further pass for
   `SETTLE_QUIET_MS`. Faster than the old sleep and it throws instead of guessing.
3. **`lastDurations` → `settledMetrics`**. Reports the LAST pass at the maximum
   `obstacleCount` (later passes supersede earlier ones) and **throws** when tied passes
   disagree on `edgeCount`, instead of letting V8's stable sort silently publish the
   earliest.

### `src/adapters/ObsidianLinkProvider.test.ts`

Two BDD characterization tests pinning the exact regime divergence — a canvas with one FILE
node and one TEXT node carrying `[[note-b]]`: fallback yields `["note-a.md"]`, core-indexed
yields `["note-a.md", "note-b.md"]`. Neither test asserts which is CORRECT; the header says
so explicitly and points at the decision ticket. This makes the plugin bug visible in
`npm test` rather than only as an e2e flake.

### No plugin behaviour changed

`src/` production code is byte-identical to the branch point (the only `src/` change is the
test file). The 10-vs-11 semantics remain a product decision.

## New ticket

`nid_s676x55uojmtcwh9t4l9mc6zl_e` — **`[decide]` Canvas link regime is re-detected per
rebuild from a racing resolvedLinks, so canvas text-node edges appear or vanish depending on
boot timing.** Self-contained: both regimes, exact file paths, the 5-run measurement table,
a reproduction, the product question, and two candidate fixes (detect once at load after
`metadataCache "resolved"` vs unify the regimes). Linked to
`nid_li45606h8uvcnjm7fss17xl1u_e`.

## Test evidence

`npm run check` → exit 0. `npm test` → exit 0, 74 files / 990 tests passed.

5 consecutive `npm run test:e2e -- edgeRoutingEval.e2e.ts`, raw `[eval] force/sparse:` lines
(all `5 passed`):

```
[eval] force/sparse: routingMs=3.4000000059604645 layoutMs=36 obstacles=13 edges=11 maxDetourRatio=1.007 meanDetourRatio=1.001
[eval] force/sparse: routingMs=3.300000011920929 layoutMs=27.5 obstacles=13 edges=11 maxDetourRatio=1.007 meanDetourRatio=1.001
[eval] force/sparse: routingMs=3.2999999821186066 layoutMs=34.19999998807907 obstacles=13 edges=11 maxDetourRatio=1.007 meanDetourRatio=1.001
[eval] force/sparse: routingMs=3.300000011920929 layoutMs=32.70000001788139 obstacles=13 edges=11 maxDetourRatio=1.007 meanDetourRatio=1.001
[eval] force/sparse: routingMs=3.9000000059604645 layoutMs=32.69999998807907 obstacles=13 edges=11 maxDetourRatio=1.007 meanDetourRatio=1.001
```

`obstacles=13 edges=11` in all 5 — acceptance met. The other rows were identical across all
5 runs too:

```
[eval] force/medium: obstacles=21  edges=20  maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense:  obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046
[eval] force/facing: obstacles=18  edges=27  maxDetourRatio=1.266 meanDetourRatio=1.047
[eval] PERF dense/force: obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046
```

Full `npm run test:e2e`: **71 passed, 1 failed**. The failure is
`e2e/vicinityGraph.e2e.ts:160` "singleton-folder note shows a folder breadcrumb…" — the
KNOWN, pre-existing headless failure already tracked in
`docs-internal/tickets/ticket-e2e-gamma-breadcrumb-fails-headless.md` and
`nid_yccejkvl0ccqc77olsgg5deka_e` ("e2e release gate is RED"), reproduced on unchanged main
before this work. Not caused here: `e2e/obsidianHarness.ts` is untouched and all 8
`edgeRoutingEval` tests passed in that same run.

### A regression I introduced and caught before shipping — reported, not buried

My first settle used quiescence ALONE. Sparse went 5/5 at 11, **but 2 of those 5 runs
published `[eval] force/dense: obstacles=3 edges=4`** — the tiny bounce-note pass. The dense
fixture's elk layout takes ~1.4s and logs only on completion, so the silence while it runs
looks exactly like the end of the burst. Fixed by additionally requiring the central
fixture's own layout pass before the quiet window may end (commit
`fix(e2e): gate the eval settle on the CENTRAL fixture's layout, not silence alone`). The
5-run evidence above is from AFTER that fix. Do not revert the settle to quiescence-only.

## Rejected options + rationale

- **Raise `waitForTimeout`** — forbidden by the ticket, and provably useless: the
  fallback regime never resolves itself, so no duration would help.
- **`page.waitForFunction` on a `.canvas` key alone** (both explorers' recommendation) —
  unreachable in ~half of launches; measured above.
- **`app.internalPlugins.enablePlugin("canvas")`** — not a function on Obsidian 1.12.7, and
  the plugin was already enabled in the failing sessions.
- **Neutralize the fixture** (ship the eval spec a `test.canvas` with no text-node wikilink,
  making both regimes yield 10) — would have worked and was the guaranteed fallback, but it
  quietly weakens the fixture. Indexing the real canvas keeps the fixture intact.
- **Fix the plugin here** (detect capability once, or unify the regimes) — out of scope for
  an e2e chore and a user-visible semantics change; escalated as a `[decide]` ticket.
- **Put the canvas-index precondition in `e2e/obsidianHarness.ts`** — no other spec needs it,
  and touching shared harness code would put every spec's timing at risk for no gain.

## Open questions

- The product question in `nid_s676x55uojmtcwh9t4l9mc6zl_e` is unanswered by design: should a
  wikilink inside a canvas TEXT node produce an edge? Until it is answered the plugin ships
  whichever regime the boot happened to land in, and the eval harness reports the
  `core-indexed` (11-edge) answer.
- WHY Obsidian's boot sweep indexes this canvas in only ~half of launches was not isolated
  (the Canvas core plugin is enabled either way). Not needed for the fix, and it is
  Obsidian-internal — noted here rather than chased.
