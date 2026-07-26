# EXPLORATION — sparse eval 10-vs-11 edge flake (harness side)

> Produced by the read-only EXPLORE agent; transcribed verbatim by TOP_LEVEL_AGENT
> (the agent had no Write tool). Line numbers are as of branch `sparse-eval-edge-flake`
> @ 92e10c9 — re-verify before editing.

## 1. `e2e/edgeRoutingEval.e2e.ts` (199 lines, full read)

- Fixtures: `FORCE_FIXTURES` at `:171-176` — `{sparse: note1.md}`, `{medium: hub-medium.md}`, `{dense: zzdense-hub.md}`, `{facing: facing/hub-facing.md}`. One `test()` per fixture generated in the loop `:178-186`; `test.describe.configure({ mode: "serial" })` at `:27`. **`sparse` is the FIRST test in the file, i.e. the first render after Obsidian boot** (important, see §6).
- `beforeAll` `:88-95`: `ObsidianHarness.launch()`, `page.on("console", onConsole)`, `openGraphView()`, `setAllEdgesVisibility()` (writes `edgeVisibility:"all-edges"` straight into `pluginDataStore`, `:101-107` — note this write does **not** fan out a refresh; the next `openFile` rebuild picks it up).
- Console capture `onConsole` `:66-86`: matches on substrings `"edge routing pass"` / `"elk+d3 layout pass"`, takes `msg.args()[1]`, pushes `arg.jsonValue()` promise into module-level `pendingPerf`. Every matching log in the window is collected — **no filtering by which rebuild it belongs to**.
- `renderFixture` `:115-130`:
  ```ts
  pendingPerf = [];
  await harness.openFile(BOUNCE_PATH);        // note2.md
  await harness.openFile(centralPath);
  await expect(page.locator(EDGE_PATH_SELECTOR).first()).toBeAttached();
  await page.waitForTimeout(4500);            // :127, fixed settle, deliberate per :120-126 comment
  const entries = (await Promise.all(pendingPerf)).filter(...);
  ```
  So the window contains the **bounce-note rebuild AND the central rebuild AND any debounced metadata-resolve rebuilds** that land inside 4.5s.
- `lastDurations` `:133-151` — ticket claim confirmed, verbatim:
  ```ts
  const heaviest = (kind, sizeOf) =>
      entries.filter((e) => e.kind === kind)
             .sort((a, b) => sizeOf(b) - sizeOf(a))[0];
  const routing = heaviest("routing", (e) => e.data.obstacleCount ?? 0);
  ```
  `Array.prototype.sort` is **stable** in V8, so on a tie in `obstacleCount` the **earliest-logged** entry wins. Two 13-obstacle passes differing in `edgeCount` ⇒ the FIRST one is reported, silently.
- `formatMetrics` `:154-165` prints `obstacles=`/`edges=` from that one entry; `edges` and the detour ratios always come from the same pass (`:147`).

## 2. Plugin-side emitter

- `src/view/GraphViewController.ts:297-303`:
  ```ts
  console.debug("vicinity-graph: edge routing pass", {
      obstacleCount: input.obstacles.length,
      edgeCount: input.edges.length,
      durationMs, maxDetourRatio: detour.max, meanDetourRatio: detour.mean });
  ```
  and layout at `:222-225` (`nodeCount`, `durationMs`).
- **Once per routing pass, and a routing pass runs on every rebuild** that is not served by `routeCache` (`:271-273`, signature = obstacles+edges+buffer). Logged **before** the `isStale` early return (`:291-295, :304`) — deliberate — so superseded passes are logged too.
- Rebuild triggers (`src/view/VicinityGraphView.tsx:121-123`): `active-leaf-change`, `file-open` → `handleActiveFileChanged` (immediate, `GraphViewController.ts:141-151`); `metadataCache.on("resolved")` → `handleMetadataResolved` → `setTimeout(..., REBUILD_DEBOUNCE_MS)` (`:171-177`, constant in `src/view/constants.ts`, 500ms).
- ⇒ **Yes: multiple passes per `renderFixture` window, and two of them can carry the same `obstacleCount=13` with different `edgeCount`** — exactly the tie `lastDurations` resolves arbitrarily (first-wins).
- Also relevant: `src/main.ts:226-240` logs `vicinity-graph debug: canvasCapability=[...]` once (provenance debug), via `console.log`, not scraped by the eval spec.

## 3. What the `sparse` graph SHOULD be — and why 10 vs 11 is a REAL content difference

`note1.md` vicinity, `all-edges`, groups on. Linkers to note1 in `.dev-vault`: `note2.md`, `test.canvas`, `projects/alpha.md`, `projects/beta.md`, `solo/gamma.md` (grep-verified); plus the harness-injected `crowd/c1..c4` (`e2e/obsidianHarness.ts:102-107`). `note1` → `note2`, `note3`.

Nodes: note1, note2, note3, test.canvas, alpha, beta, gamma, c1-c4 = 11 notes + 2 group boxes (`projects/`, `crowd/`) = **13 obstacles ✓** (matches every observed run).

Flow edges via `buildFlowEdges` (`src/view/flowMapping.ts:237-276`; intra-group + ungrouped pairs stay passthrough as *separate directed* edges, cross-group fans collapse per unordered pair):

| # | edge |
|---|---|
|1|note1→note2|
|2|note2→note1|
|3|note1→note3|
|4|test.canvas→note1|
|5|test.canvas→note3|
|6|alpha→beta (intra-group passthrough)|
|7|beta→alpha|
|8|gamma→note1|
|9|collapsed `projects/`↔note1 (alpha+beta)|
|10|collapsed `crowd/`→note1 (c1..c4)|

= **exactly 10**. The 11th is `test.canvas→note2`: the canvas TEXT node `"Text node with a [[note2]] wikilink — skipped in V1."` (`scripts/setup-dev-vault.sh:72`).

Which of the two you get depends on the canvas link source, decided **per build**:
- `src/adapters/VicinityGraphBuilder.ts:41` — `await ObsidianLinkProvider.create(...)` on EVERY `build()`.
- `src/adapters/ObsidianLinkProvider.ts:72` — `CanvasCapabilityDetector.detect(Object.keys(metadataCache.resolvedLinks))`.
- `src/adapters/CanvasCapability.ts:20-26` — returns `core-indexed` iff **any** `.canvas` key is present in `resolvedLinks` at that instant, else `fallback-required`.
- `fallback-required` ⇒ `CanvasFallbackParser` (`src/adapters/CanvasFallbackParser.ts:47-55`) yields **file-type nodes only** ⇒ canvas→{note1,note3} ⇒ **10 edges**.
- `core-indexed` ⇒ Obsidian's own `resolvedLinks` for `test.canvas`, which **does** include the text node's `[[note2]]` ⇒ **11 edges**.

So neither 10 nor 11 is "wrong routing"; they are two different **link-source regimes**, and the regime is chosen by a boot-time index race. "Correct" per V1 scope doc (`CanvasFallbackParser.ts:7`, "Wikilinks inside text nodes are [skipped]") = 10; correct per Obsidian ≥1.12.4 core = 11. The plugin currently ships whichever the index happens to have finished.

Corroborating: `edges=11` runs always show `maxDetourRatio>1.000`, `edges=10` runs always `1.000` (SWEEP §2.3) — the extra canvas→note2 chord is the only thing that ever detours here.

## 4. Shared e2e harness

- `e2e/obsidianHarness.ts` — launches real Obsidian 1.12.7 over CDP (`--remote-debugging-port=0`, `chromium.connectOverCDP`), `--user-data-dir=.tmp/e2e/obsidian-config`, vault = fresh `cpSync` copy of `.dev-vault` → `.tmp/e2e/vault` (`:388-417`), `data.json` deleted per run (`:410`), `crowd/c1..c4` written (`:102-107,:411-416`), window state pre-seeded 1280x800 (`:88-89,:439-442`).
- Settings per test are applied by writing `pluginDataStore` directly: `setGlobalNodeCap` `:311`, `setMaxNodeSizePx` `:328`, `setNodePreviewPreference` `:349` (this one also calls `plugin.refreshOpenViews()`), `readGlobalView` `:366`. The eval spec has its own local `setAllEdgesVisibility` (`edgeRoutingEval.e2e.ts:101`) — duplicated in `edgeRouting.e2e.ts:109`.
- **Existing deterministic-wait prior art to reuse:**
  - `page.waitForFunction` on app state: `obsidianHarness.ts:496` (`app.workspace.layoutReady === true`), `:515` and `:550` (plugin loaded), `settingsResetReview.e2e.ts:314`.
  - `expect.poll(...)` on a computed DOM/state readout: `edgeRouting.e2e.ts:218` (`bentEdgeCount > 0`) and `:245-248` — the latter has the canonical comment: *"Poll for READINESS only (terminals present), so the settle is condition-driven rather than a magic sleep."*
  - `expect.poll` on plugin store: `controlsRestart.e2e.ts:151`.
  - `edgeRoutingEval.e2e.ts:127` is the **only** `waitForTimeout` of consequence in the suite (the other, `settingsResetVerify.e2e.ts:157`, is 200ms).
- There is **no** window-global test hook exposed by `src/` today (grep for `__vicinity`/`window as` in src: none outside `window.setTimeout`). Adding one (e.g. a monotonically-increasing publish counter / last-published edge count on the view) is greenfield; a cheaper existing signal is polling `page.locator(".vicinity-graph-flow .react-flow__edge-path")` count for stability, or polling `app.metadataCache.resolvedLinks` for a `.canvas` key before the first render.

## 5. Can e2e run here? YES

- Obsidian binary already cached and executable: `/…/.tmp/obsidian/obsidian-1.12.7/obsidian` (199 MB, mode `-rwxr-xr-x`). `scripts/setup-obsidian-bin.sh` pins 1.12.7, Linux x86_64 tarball, prints the cached path (no re-download).
- `scripts/run-e2e.sh` auto-exports `OBSIDIAN_PATH` and, when no `DISPLAY`/`WAYLAND_DISPLAY`, sets `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"` — this environment is display-less, so that path applies. Harness adds `--no-sandbox` on Linux (`obsidianHarness.ts:183`).
- `e2e/playwright.config.ts`: `workers: 1`, `fullyParallel: false`, `retries: 0`, test timeout 120s, expect timeout 15s.
- Exact command: `npm run test:e2e -- edgeRoutingEval.e2e.ts`.
- Duration: run-e2e first does `npm run build` (tsc + esbuild) and `npm run setup:dev-vault`, then the spec itself — recorded as **`5 passed (25.9s)`** in `.ai_out/edge-routing__06/main/STEP4_FIXTURE__PUBLIC.md:44`; budget ~1.5-2 min wall-clock end-to-end per run. The explore agent did **not** run it.

## 6. Prior art

- Ticket: `_tickets/e2e-sparse-eval-fixture-flips-between-10-and-11-edges-run-to-run.md` (in_progress) — Design section already forbids raising the timeout and asks exactly the two questions answered above; AC = same `edges=` across ≥5 consecutive runs, and "if plugin-side, file a separate bug ticket".
- `.ai_out/edge-routing__06/main/SWEEP__PUBLIC.md` §2.2 ("**Sparse caveat — do not use it**") + §2.3 verbatim lines + §10 ("not investigated; looks like a settle-timing race; pre-existing").
- `.ai_out/edge-routing__06/main/STEP4_FIXTURE__PUBLIC.md:63` — same flip observed twice in one day.
- `.ai_out/edge-routing-04/edge-routing-04-boundary-pins/VERIFICATION__PUBLIC.md:143` — sparse recorded as 13/10.
- Headless-flake tickets (pattern, not same cause): `docs-internal/tickets/ticket-e2e-node-click-flaky-headless.md`, `ticket-e2e-gamma-breadcrumb-fails-headless.md`, `ticket-e2e-headless-culling-unmounts-main-node.md`. Their accepted remedies are *fixture/environment* fixes (sparser fixtures, real window size), never longer sleeps — consistent with the repo's stated preference for condition polls.

## Hypotheses ranked

**H1 (most likely) — plugin-side regime race in canvas capability detection, surfaced by the harness tie-break.**
Evidence: 10 and 11 are *exactly* the fallback vs core-indexed edge sets computed above (canvas text-node `[[note2]]` is the 11th); capability is re-detected on **every** `build()` (`VicinityGraphBuilder.ts:41` → `ObsidianLinkProvider.ts:72` → `CanvasCapability.ts:20`) from the live, still-filling `resolvedLinks`; `sparse` is the first fixture rendered after boot, `medium`/`dense`/`facing` come later (index settled) **and** contain no canvas file — which explains why only sparse flips. Detour ratios track the edge count, not the router.

**H2 (contributing, harness-side) — tie-break in `lastDurations` hides the final truth.**
Evidence: `sort((a,b)=>size(b)-size(a))[0]` with stable sort ⇒ on `obstacleCount` ties the earliest pass wins (`:137-141`); the 4.5s window certainly contains ≥2 passes (bounce rebuild, central rebuild, plus 500ms-debounced `metadata "resolved"` rebuilds — `VicinityGraphView.tsx:123`, `GraphViewController.ts:171-177`). So even after the graph converges to 11, an earlier 13/10 pass is what gets printed. H2 alone cannot *create* the two different edge sets — it only decides which one is reported — so it is a magnifier of H1, not an independent cause.

**H3 (unlikely) — layout/route nondeterminism.** Ruled out: `edgeCount` is `input.edges.length` from `extractEdgeRoutingInput` (`src/view/edgeRouting.ts:160-166`), which only drops edges whose endpoint has no obstacle; `obstacleCount` is constant at 13 in every run, so no obstacle was ever dropped, so no edge could be dropped for that reason. Force-layout jitter cannot change edge cardinality.

**H4 (unlikely) — console capture loss.** `onConsole` awaits `jsonValue()` and swallows failures to `null` (`:80-85`); a dropped entry would change *which* pass is seen, not its edge count, and would more plausibly show up as `undefined` fields.

### Implications for the fix
- Root cause is **plugin-side** (H1) ⇒ per the ticket AC, a separate product ticket is warranted: "canvas link source (core-indexed vs fallback) is decided per build from a racing `resolvedLinks`, so canvas-sourced edges appear/disappear during startup" — candidate product fix: detect capability once at plugin load / after `metadataCache "resolved"`, or unify the two regimes so text-node links are treated the same way in both.
- Harness fix (no fixed-timeout increase): before/at measurement, poll a settled condition — e.g. `expect.poll` on the rendered `.react-flow__edge-path` count being stable across two samples, or `page.waitForFunction` on `Object.keys(app.metadataCache.resolvedLinks).some(k => k.endsWith(".canvas"))` before the first render — and make `lastDurations` prefer the **last** heaviest entry (or assert the tie is unambiguous) instead of silently taking the first.
