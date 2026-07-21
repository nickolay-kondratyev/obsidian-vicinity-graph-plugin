# Step-07 Hardening — Performance Surface Map

Repo root: `/home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-neighborhood-graph`

Scope: image loading, rebuild frequency/debounce, structural-diff elk skip, orphan-sweep chunking, and where perf could be tested. This is a map for the implementation agent — no code changed.

---

## 1. Image loading (thumbnails)

**File:** `src/view/NoteNode.tsx`

```tsx
const thumbnailUrl = useMemo(
  () => (data.firstImagePath === undefined ? null : ui.resourcePath(data.firstImagePath)),
  [ui, data.firstImagePath],
);
...
{thumbnailUrl !== null && (
  <div className="neighborhood-graph-node__thumbnail">
    <img src={thumbnailUrl} alt="" loading="lazy" draggable={false} />
    ...
  </div>
)}
```

Key facts:
- `NoteNode` is `memo(...)` (src/view/NoteNode.tsx:24) with the **default shallow-prop comparator** — no custom `arePropsEqual`. React Flow passes a fresh `data` object reference on every node array rebuild (see `toFlowNodeData` in `src/view/flowMapping.ts:180-195`, called from `neighborhoodGraphToFlow`, which is called unconditionally on **every** `runRebuild()` in `GraphViewController.ts:171`, even on the `reuse-layout` fast path). So **every rebuild re-renders every `NoteNode`**, structural-diff or not.
  - Despite the re-render, `thumbnailUrl` is `useMemo`'d off `data.firstImagePath` (a **primitive string**, not an object), so as long as the image path string is unchanged, `thumbnailUrl` recomputes to the same value → React reconciles the `<img>` to the same `src` → **no new network request** (browser dedupes on the resource URL). This is the "no refetch storm" guarantee, but it is implicit/emergent, not an explicit invariant, and it is **not tested anywhere**.
  - `ui.resourcePath()` is `ObsidianGraphUi.resourcePath` (`src/view/ObsidianGraphUi.ts:26-29`): `app.vault.getResourcePath(file)`. Obsidian's `getResourcePath` embeds the file's mtime as a cache-busting query param, so the URL only changes when the underlying file's content changes — reinforcing "no refetch unless the image itself changed," but this is an Obsidian implementation detail the plugin does not control or assert.
- **Lazy loading**: the ONLY mechanism is the native HTML `loading="lazy"` attribute on the `<img>` (line 80). This defers the browser's *image byte fetch* until the element nears the *browser viewport* (the whole plugin pane/window), not the *React Flow pane's pan/zoom viewport*. It is a real, if coarse, lazy-load. There is no JS-driven viewport culling of which `<img>` elements even exist in the DOM.
- **Viewport culling**: **NOT FOUND**. `NeighborhoodGraphFlow.tsx` (`src/view/NeighborhoodGraphFlow.tsx:84-119`) renders `<ReactFlow>` with no `onlyRenderVisibleElements` prop set (confirmed via `grep -rn "onlyRenderVisibleElements"` — zero hits in `src/`). React Flow's own default for that prop is `false`, meaning **every node in the graph is mounted in the DOM regardless of pan/zoom position** — for a capped-at-N-nodes graph (engine caps, e.g. 100+) that's N `<img>` lazy-load candidates all "close enough" to viewport almost immediately once the browser's IntersectionObserver margin kicks in, defeating a lot of the lazy-load's practical benefit on a fully zoomed-out large graph.
- No `IntersectionObserver`, no `useViewport`/`useStore` usage anywhere in `src/view/*.tsx` (confirmed via grep).
- No `content-visibility` / `contain` CSS properties in `styles.css` (grep found none) that would give a cheap CSS-only culling fallback.
- **No test file exists for `NoteNode.tsx` at all** (`find src -iname "NoteNode*"` returns only the source file). There is no test asserting the thumbnail behavior, the lazy attribute, or a "no refetch on rebuild" invariant.

### Gaps / concrete findings — image loading
1. **No viewport culling** — `onlyRenderVisibleElements` is never set on `<ReactFlow>`. On a dense/image-heavy vault at cap, all thumbnails are in the DOM at once (mitigated only by native `loading="lazy"`'s coarse viewport check).
2. **No explicit "no refetch storm" guarantee/test** — the current safety is an emergent property of `useMemo` keyed on a primitive path string plus Obsidian's own resource-URL caching; nothing in the codebase asserts this, and a future refactor (e.g. changing `firstImagePath` typing, or making `NoteNode`'s data include an object instead of the raw string) could silently break it.
3. **No `NoteNode.tsx` test file** — zero unit coverage of thumbnail rendering, `loading="lazy"`, or the pin/attachment UI in that file.
4. Because `neighborhoodGraphToFlow` always creates fresh node `data` objects even on the `reuse-layout` path, **every** `NoteNode` re-renders on every rebuild (structural-diff only skips the elk *layout* call, not the React re-render of node contents) — worth measuring whether this matters at scale, and whether a stable per-node data reference (with structural equality) is worth adding to let `memo` actually skip re-renders when nothing about that specific node changed.

---

## 2. Rebuild frequency / debounce pipeline

**Files:**
- `src/view/RebuildDecision.ts` — pure "should an active-file switch trigger a rebuild" decision.
- `src/view/GraphStructureDiff.ts` — pure "does the new graph need a fresh elk layout" decision.
- `src/view/ElkLayoutRunner.ts` — thin elkjs wrapper (in-thread, no web worker).
- `src/view/GraphViewController.ts` — the sequencer/orchestrator; owns debounce timer, rebuild token, and publish.
- `src/view/constants.ts` — `REBUILD_DEBOUNCE_MS = 500`, `SIZE_RELAYOUT_THRESHOLD = 1.0`.

### Rebuild decision flow (concrete, from `GraphViewController.ts`)

Three event entry points, each with different debounce/gating behavior:

1. **`handleActiveFileChanged(activePath)`** (line 104-114) — called when Obsidian's active leaf changes.
   ```ts
   handleActiveFileChanged(activePath: string | null): void {
     const outcome = decideActiveFileRebuild(activePath, this.mainPath);
     if (outcome.kind === "ignore") return;
     this.clearDebounce();      // drops any pending debounced metadata-resolve rebuild
     this.mainPath = outcome.mainPath;
     void this.runRebuild();    // IMMEDIATE, no debounce
   }
   ```
   Gating is via `decideActiveFileRebuild` (`RebuildDecision.ts:16-27`): ignores `null` active path, ignores non-node-bearing files (`FileKinds.isNodeBearingPath` — images/PDFs don't rebuild), and ignores re-activating the file that's already MAIN (no-op). Otherwise rebuild fires **immediately** (no debounce) — matches Obsidian's own graph.

2. **`handleSettingsChanged()`** (line 123-126) — toolbar/stepper/settings-tab writes. Also **immediate**, no debounce (comment: "the executor already awaited the write... latest-wins rebuildToken absorbs stepper bursts").

3. **`handleMetadataResolved()`** (line 134-140) — wired in `src/view/NeighborhoodGraphView.tsx:109`:
   ```ts
   this.registerEvent(this.app.metadataCache.on("resolved", () => controller.handleMetadataResolved()));
   ```
   This is **THE debounce for typing bursts** in a linked note:
   ```ts
   handleMetadataResolved(): void {
     this.clearDebounce();
     this.debounceTimer = window.setTimeout(() => {
       this.debounceTimer = null;
       void this.runRebuild();
     }, REBUILD_DEBOUNCE_MS); // 500ms
   }
   ```
   Every `"resolved"` event (Obsidian fires these repeatedly as metadata cache catches up after edits) **restarts** a 500ms timer; only the last one in a burst survives to fire `runRebuild()`. This is the mechanism the step-07 doc's "typing bursts... stay within one debounce window" requirement targets.

   **Gap**: The comment in `GraphViewController.test.ts:24` explicitly says *"The debounced metadata-resolve path is intentionally out of scope (it needs `window`)"* — **there is NO test exercising `handleMetadataResolved`'s debounce/coalescing behavior** (no fake timers, no `vi.useFakeTimers()` anywhere in the view test suite as far as this file goes). This is the #1 gap for the "rebuild frequency" perf item.

### `runRebuild()` pipeline (`GraphViewController.ts:153-183`)

```ts
private async runRebuild(): Promise<void> {
  const token = ++this.rebuildToken;
  const mainPath = this.mainPath;
  if (mainPath === null) { this.reset(); return; }
  const result = await this.graphBuilder.build(mainPath);
  if (this.isStale(token)) return;
  if (result === null || result.graph.nodes.length === 0) { this.reset(); return; }
  const graph = result.graph;
  this.controls = result.controls;
  const decision = decideLayout(this.previousGraph, graph, SIZE_RELAYOUT_THRESHOLD);
  const flow = neighborhoodGraphToFlow(graph);
  if (decision === "reuse-layout") {
    console.debug("neighborhood-graph: structural diff skipped elk layout (data-only refresh)");
    this.publish(graph, this.positions, this.groupDimensions, flow);
    return;
  }
  const laidOut = await this.layoutRunner.layout(neighborhoodGraphToElk(graph));
  if (this.isStale(token)) return;
  this.publish(graph, extractElkPositions(laidOut), extractElkDimensionsById(laidOut), flow);
}
```

Flow: **events → engine build (`graphBuilder.build`) → structural diff (`decideLayout`) → [skip or run elkjs] → flowMapping → publish (external store)**.

Concurrency safety: monotonic `rebuildToken` (latest-wins) checked via `isStale()` both after the engine build AND after elk layout — a slow stale build/layout can never clobber a newer result. No sleeps; correctness proven via deferred-promise resolution order in tests (see below), not timers.

There is a `console.debug` breadcrumb on the skip path (line 174) — the closest thing to a measurable "skip rate" signal today, but it's a raw console line, not a counter/metric exposed anywhere for tests or telemetry.

### `decideLayout` (structural diff) — `src/view/GraphStructureDiff.ts`

```ts
export function decideLayout(
  previous: NeighborhoodGraph | null,
  next: NeighborhoodGraph,
  sizeGrowthThreshold: number,
): LayoutDecision  // "relayout" | "reuse-layout"
```
Rules (in order): no previous → `relayout`; `groupByFolder` flip → `relayout`; node-id-set changed → `relayout`; edge-id-set changed → `relayout`; any surviving node grew `sizePx` by more than `sizeGrowthThreshold` (fraction, default `1.0` = +100%) → `relayout`; else `reuse-layout`. Node/edge identity comes from `nodeIdsOf`/`edgeIdsOf` (path / `edgeIdOf` from `graphIdentity.ts`), compared via `sameIds` (size + full membership check, O(n)).

Well covered by `src/view/GraphStructureDiff.test.ts`: no-previous, unchanged→reuse, node-added→relayout, edge-added→relayout, size-growth exactly-at-threshold (reuse) vs just-over (relayout), shrink (reuse), groupByFolder flip (relayout). **No test currently measures/asserts a "skip rate"** across a sequence of typing-driven rebuilds — that's a gap matching the step-07 doc's explicit ask ("structural-diff skip rate measured").

### `ElkLayoutRunner` — `src/view/ElkLayoutRunner.ts`

```ts
export class ElkLayoutRunner {
  private readonly elk = new ELK();
  layout(graph: ElkNode): Promise<ElkNode> {
    return this.elk.layout(graph);
  }
}
```
Uses `elkjs/lib/elk.bundled.js` — runs **in-thread** (main thread), not in a web worker (explicit V1 decision per the doc comment, "matching the V1 'inline async, no web worker' decision"). This means elk layout time IS main-thread time; skipping it via structural diff is the only mitigation currently in place (there's no worker offload to fall back on). `src/view/ElkLayout.test.ts` exists (not read in depth here, but is the elk-mapping/layout-focused test file — worth checking for any size/timing assertions during implementation, none were found via the timing/duration grep).

### Existing tests covering this pipeline
- `src/view/RebuildDecision.test.ts` — full coverage of the pure decision (5 cases).
- `src/view/GraphStructureDiff.test.ts` — full coverage of the pure diff (as above).
- `src/view/GraphViewController.test.ts` — latest-wins concurrency (stale-discard, stale-never-reaches-elk, latest-wins-render), null/empty handling, MAIN gating, settings-changed immediate rebuild, **and** a "structural diff" describe block (`GraphViewController.test.ts:226-266`) that checks `layout.callCount` stays at 1 across a reuse-layout rebuild, `2` across a relayout, and that positions are preserved on reuse — this is effectively the "skip elk on unchanged structure" integration test, driven via `FakeGraphSource`/`FakeLayout`/deferred promises + `flush()` (drains microtasks via `setImmediate`), **never real timers**.
- **No test exists for the debounce timer itself** (`handleMetadataResolved`/`REBUILD_DEBOUNCE_MS`) — confirmed gap.

---

## 3. Orphan sweep (doc-data cleanup)

**Files:**
- `src/persistence/OrphanSweeper.ts` — the sweep orchestrator.
- `src/persistence/SweepPlanner.ts` — pure orphan judgment (docid → live/dead).
- `src/persistence/ChunkedWork.ts` — the chunk/yield primitive.
- `src/persistence/DocDataStore.ts` — doc-data file storage (`listDocIds`, `load`, `update`, `remove`).
- Wiring: `src/main.ts` (`scheduleOrphanSweep`, `docDataDirPath`, `SWEEP_DELAY_MS` import).

### Storage location
Doc-data files live at `<pluginDir>/doc-data/<docid>.json` (`src/main.ts:110-113`, `docDataDirPath()`), i.e. `.obsidian/plugins/obsidian-neighborhood-graph/doc-data/`. `DocDataStore.listDocIds()` (`DocDataStore.ts:67-75`) lists that directory via `storage.list(dirPath)`, filters to `.json` files, strips the extension, and filters through `DocPersistEligibility.isFilenameSafeDocId` (so a malformed/foreign file like a sync-conflict artifact is silently skipped, not thrown on — covered by an `OrphanSweeper.test.ts` case).

### Chunking mechanism — `ChunkedWork.forEachChunked`

```ts
static async forEachChunked<T>(
  items: readonly T[],
  batchSize: number,
  work: (item: T) => void | Promise<void>,
  yieldBetweenBatches: () => Promise<void> = ChunkedWork.sleepZero,
): Promise<void> {
  for (let index = 0; index < items.length; index++) {
    await work(items[index]);
    const batchBoundary = (index + 1) % batchSize === 0 && index + 1 < items.length;
    if (batchBoundary) await yieldBetweenBatches();
  }
}
static sleepZero(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
```
Yields after every full batch (never after the last, partial-or-not — "no trailing idle hop"). Default yield is a real macrotask hop (`setTimeout(0)`), which DOES release the main thread (the file's own doc comment explicitly notes "async alone does NOT yield the event loop"). `yieldBetweenBatches` is injectable, which is how tests count yields without a real timer.

### `OrphanSweeper` — chunked phases (`SWEEP_BATCH_SIZE = 20`, `src/persistence/OrphanSweeper.ts:12`)
Three chunked phases, all going through `private forEachChunked` (line 130-132) which threads `SWEEP_BATCH_SIZE` and the injected yield fn:
1. `warmMapAndCollectLiveDocids()` — chunked over every eligible vault file, calling `docIdPort.getDocId(file)` (read-only) per file.
2. `collectCentralDocidsByOwner()` — chunked over live doc-data owners, one `docDataStore.load()` read per owner.
3. `apply()` — three separate chunked loops: doc-data deletion, then a single unchunked bulk pin removal (comment: "One data.json write for all stale pins — no reason to chunk a single call"), then chunked central-depths stripping per owner.

`SWEEP_DELAY_MS = 15_000` (`OrphanSweeper.ts:10`) — the sweep is scheduled 15s after plugin load via `window.setTimeout` in `main.ts:scheduleOrphanSweep()` (uses the real, non-injected `OrphanSweeper` constructor default `ChunkedWork.sleepZero`, so production yields ARE real macrotask hops).

**This already IS the "chunk-yield mechanism"** the step-07 doc's orphan-sweep bullet asks about — it exists, is tested, and is wired into `main.ts`. Nothing here appears unimplemented; the remaining work per the step-07 doc is **measurement at "hundreds of doc-data files" scale**, not building new chunking machinery.

### Existing tests
- `src/persistence/ChunkedWork.test.ts` — 4 cases: all items visited in order; yields exactly at batch boundaries (5 items / batch 2 → 2 yields, never after the last); no yield when everything fits in one batch; no yield on empty input.
- `src/persistence/OrphanSweeper.test.ts` — a `LIVE_NOTE_COUNT = 25` fixture (deliberately `> SWEEP_BATCH_SIZE (20)`, comment: "so the warm phase must yield at least once"), asserting `yieldCount() > 0` (line 101-104: `"WHEN the vault exceeds one batch THEN the sweep yields the main thread between batches"`). Also covers: doc-data deletion for vanished docs, survival for live docs, pin removal, centralDepths stripping (with sibling-field preservation), path→docid map warm-up, "never creates ids" (read-only proof), foreign/unsafe-stem file tolerance, summary counts, and a whole second fixture (`midSweepWriteFixture`) for the create-during-sweep race (docid created/pinned mid-warm-up must NOT be treated as orphaned — re-verified at drop time via `isConfirmedOrphan`).

### Gaps / concrete findings — orphan sweep
1. **25 items is far short of "hundreds"** — the existing test only proves the yield mechanism fires at all (`> 0` yields), not that it scales sanely (yield *count*, wall-clock jank) at hundreds of doc-data files. This is exactly the step-07 doc's ask: "orphan sweep on a vault with hundreds of doc-data files: no main-thread jank (chunk yields observable)." A perf-hardening test should extend the fixture to e.g. 300-500 files and assert yield count scales as `Math.floor(n / SWEEP_BATCH_SIZE)` (matching `ChunkedWork`'s boundary formula) and/or measure wall time per batch is bounded.
2. `SWEEP_BATCH_SIZE = 20` is a hardcoded constant (`OrphanSweeper.ts:12`) with no test asserting *why* 20 specifically is "never felt" — no timing budget attached. Worth an explicit perf budget assertion once real batch costs are measured (per step-07 doc's "Perf budget numbers" open item).
3. `collectCentralDocidsByOwner` and `warmMapAndCollectLiveDocids` are chunked, but note each **await inside a chunked loop is itself an async op** (`docIdPort.getDocId`, `docDataStore.load`) — at hundreds of files with real disk I/O (vault adapter reads), the batch's wall time could dominate over the yield's benefit; nothing currently measures per-batch duration.

---

## 4. Existing performance-related tests / timing assertions (repo-wide)

Searched (`grep -rln "performance.now|Date.now|duration|budget|timing|elapsed|toBeLessThan|jank|debounce" --include="*.test.ts*"`):
- `src/view/flowMapping.test.ts` — only hit is `toBeLessThan` used for **array-index ordering** (`ids.indexOf("folder-group:notes")).toBeLessThan(ids.indexOf("notes/a.md"))`), NOT a timing assertion — a false positive on the keyword search, confirmed by reading.
- `src/view/GraphViewController.test.ts` — only hit is a prose comment mentioning "sleeps or timers" (explaining tests avoid them), not an actual timing test.

**Conclusion: there are ZERO real timing/perf-budget assertions anywhere in the current test suite.** All "timing sanity" language in `docs-internal/plan/steps/step-07-hardening.md` is aspirational — nothing has been built yet for:
- Dense-vault fixture generation (step-07 doc's own "Dense-vault fixtures" scope item — `scripts/` only has `setup-dev-vault.sh`, `setup-obsidian-bin.sh`, `run-e2e.sh`; no generator script; `find -iname "*dense*"` and `*fixture*` outside `src/*/testFixtures` return nothing relevant).
- No `test:heavy` npm script exists (`package.json` scripts: `dev`, `setup:dev-vault`, `setup:obsidian`, `build`, `check`, `test`, `test:e2e`, `test:watch`, `test:sublib` — no heavy/perf split).
- No `vi.useFakeTimers()` usage found in the view test suite (would be needed to test `REBUILD_DEBOUNCE_MS` deterministically without real 500ms waits).

---

## 5. Where perf budgets/targets could be asserted in tests

Concrete slots identified for the implementation agent:

1. **Debounce coalescing** (`GraphViewController.handleMetadataResolved`): a new test using `vi.useFakeTimers()` (Vitest supports this) driving multiple `handleMetadataResolved()` calls within `REBUILD_DEBOUNCE_MS`, advancing time, and asserting `source.calls.length === 1` (single rebuild for a burst) — this closes the explicitly-called-out gap in `GraphViewController.test.ts:24`.
2. **Structural-diff skip rate**: extend `GraphViewController.test.ts`'s "structural diff" describe block (or a new file) to run a sequence of N rebuilds (e.g. simulating N typing-driven metadata-resolve events where only note *content*, not links, changed) and assert `layout.callCount` stays at 1 (100% skip rate) vs. total rebuild attempts — turning "skip rate measured" from a `console.debug` line into an assertable metric. Consider exposing a small counter (e.g. `relayoutCount`/`reuseCount` or a callback hook) on `GraphViewController` for testability, since currently the only signal is the console line at `GraphViewController.ts:174`.
3. **Orphan sweep at scale**: extend `OrphanSweeper.test.ts`'s fixture to hundreds of doc-data files (e.g. 300-500, several multiples of `SWEEP_BATCH_SIZE=20`) and assert: (a) yield count matches `Math.floor(n/20)` minus edge cases per `ChunkedWork`'s boundary rule, (b) (optionally, with real timers/`performance.now()` in a non-CI-flaky way, or just structurally) that no single "batch" of work exceeds a stated budget — the step-07 doc's own open item #1 ("Perf budget numbers: acceptable rebuild time at cap=100... set explicit targets before measuring") applies here too: a concrete ms budget needs to be chosen before assertions can be written.
4. **Image loading / NoteNode**: since there's no test file today, a new `src/view/NoteNode.test.tsx` (or similar, using whatever RTL/jsdom setup other `.tsx` tests use — check if any `.test.tsx` files exist yet; none were found in the `find -iname "*.test.ts*"` listing, meaning **no React component test infrastructure exists in this repo yet** — component tests here would be a first, likely requiring `@testing-library/react` + jsdom setup not currently present) could assert: `loading="lazy"` is present; the `<img src>` stays referentially stable (string-equal) across two `neighborhoodGraphToFlow` calls with unchanged `firstImagePath`; `thumbnailUrl` is `null` when `firstImagePath` is undefined.
5. **Elk layout timing**: no current mechanism measures `ElkLayoutRunner.layout()` wall time; a future perf test could wrap/spy on `elk.layout()` and assert it's only invoked once per structural change in a longer rebuild sequence (extension of point 2), or (with dense fixtures per the step-07 doc) assert a specific graph size lays out within a stated budget on the dev machine — again gated on choosing the budget number first (step-07 doc open item #1).

---

## Summary of concrete gaps (quick reference)

| Area | Finding | File(s) |
|---|---|---|
| Image loading | No `onlyRenderVisibleElements` on `<ReactFlow>` → no pan/zoom viewport culling of node DOM (incl. thumbnails); only native `loading="lazy"` (browser-viewport-based) exists | `src/view/NeighborhoodGraphFlow.tsx`, `src/view/NoteNode.tsx:80` |
| Image loading | "No refetch storm" is emergent (primitive-keyed `useMemo` + Obsidian's mtime-based resource URLs), not an explicit invariant or test | `src/view/NoteNode.tsx:27-30`, `src/view/ObsidianGraphUi.ts:26-29` |
| Image loading | Zero test coverage of `NoteNode.tsx`; no `.test.tsx` infra exists in repo at all | (absent) |
| Rebuild frequency | `handleMetadataResolved` debounce (500ms, `REBUILD_DEBOUNCE_MS`) has **no test** — explicitly called out as out-of-scope in existing test file comment | `src/view/GraphViewController.ts:134-140`, `GraphViewController.test.ts:24` |
| Rebuild frequency | Structural-diff skip is only surfaced via a `console.debug` line, not a queryable metric/counter | `src/view/GraphViewController.ts:174` |
| Rebuild frequency | No "skip rate" measured across a rebuild sequence | (absent) |
| Elk layout | Runs in-thread (no worker) by explicit V1 decision — the structural-diff skip is the ONLY mitigation; no timing assertions exist | `src/view/ElkLayoutRunner.ts` |
| Orphan sweep | Chunk/yield mechanism EXISTS and is tested, but only proven at 25 items (`> SWEEP_BATCH_SIZE`), not "hundreds" | `src/persistence/OrphanSweeper.ts`, `OrphanSweeper.test.ts:14-15,101-104` |
| Orphan sweep | `SWEEP_BATCH_SIZE = 20` has no attached timing budget/rationale beyond a code comment | `src/persistence/OrphanSweeper.ts:12` |
| General | Zero timing/perf-budget assertions anywhere in the suite today; no dense-vault fixture generator; no `test:heavy` script | repo-wide |
| General | Step-07 doc's own open item #1 ("perf budget numbers... set explicit targets before measuring") is unresolved — needed before most perf assertions above can be written | `docs-internal/plan/steps/step-07-hardening.md:43` |
