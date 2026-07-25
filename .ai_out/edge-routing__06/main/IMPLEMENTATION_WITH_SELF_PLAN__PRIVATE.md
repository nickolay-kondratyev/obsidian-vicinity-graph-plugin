# IMPLEMENTATION_WITH_SELF_PLAN — PRIVATE (edge-routing__06 step 0)

## Status: DONE. All 6 plan steps complete, all verification green (one known pre-existing unit failure).
Not committed — TOP_LEVEL_AGENT commits. Public result: `STEP0_E2E_REPAIR__PUBLIC.md` (same dir).

## What I changed and why

**Only two files, both under `e2e/`. `src/` untouched (hard constraint).**

1. `e2e/edgeRoutingEval.e2e.ts`
   - Deleted `type LayoutMode`, the `renderFixture` `mode` param, and the `harness.setLayoutMode` call.
   - Deleted the whole layered test and the whole radial "gated off" test. The radial one had
     `expect(routingMs).toBeUndefined()` — routing is now unconditional, so it would have FAILED, not
     just been dead. Good thing it was deleted rather than "collapsed to force".
   - Rewrote the PERF BUDGET comment prose (it described the radial gate). **Kept the 3 assertions
     byte-identical** — they are behavior-capturing.
   - Header docblock: "screenshot per (fixture × layout mode)" → "per fixture", + mentions detour ratios.
   - Metrics: added `maxDetourRatio?`/`meanDetourRatio?` to `PerfEntry["data"]`; extracted a named
     `EvalMetrics` interface (was an inline return type — CLAUDE.md says be classy with named types);
     `lastDurations` returns both ratios **off the same `routing` heaviest entry** so cost+quality
     describe ONE pass; new `formatMetrics()` because the `[eval]` template was already duplicated in
     2 places and 6 fields would have made that worse (DRY).
   - Ratios formatted `toFixed(3)` via `DETOUR_RATIO_DIGITS`. Raw floats print as e.g.
     `1.3420000000000001` — unscannable. ms values left raw (unchanged from before).
2. `e2e/obsidianHarness.ts` — deleted `setLayoutMode` entirely (was `:297-307`). No caller left.

Left alone deliberately: `e2e/edgeRouting.e2e.ts:22` ("radial star"), `e2e/obsidianHarness.ts:85,:127`
("layered on top of") — plain English, not layout modes. The grep will always show these 3; that is
the expected steady state, don't "fix" them on a future pass.

## The key insight (don't re-derive this)

`maxDetourRatio`/`meanDetourRatio` were **already** in the scraped console payload
(`src/view/GraphViewController.ts:280-286`). The spec's `PerfEntry["data"]` type just didn't declare
them, so `jsonValue()` returned them and TS silently dropped them. Pure e2e-side fix — do NOT go
add logging to the plugin.

## Commands that worked (all from repo root)

```bash
npx tsc -p e2e/tsconfig.json --noEmit          # exit 0
grep -rn -iE "layered|radial|layoutMode" e2e/  # 3 benign hits only
npm run test:e2e -- edgeRoutingEval.e2e.ts     # 4 passed (19.8s), exit 0
npm test                                        # 1 failed | 768 passed — known pre-existing
```

## Environment gotchas (cost me time — read this first next run)

- **The bash wrapper prints ~20 lines of shell-startup noise on EVERY Bash call** (`Starting: [source
  …]`, `Updating GIT username…`). Unavoidable; budget context for it. Redirect real output to `.tmp/`
  and grep it rather than dumping logs.
- **First e2e run downloads Obsidian 1.12.7 (~200MB tarball)** → cached at
  `.tmp/obsidian/obsidian-1.12.7/obsidian`. First run took ~4 min wall (download + prod build +
  dev-vault seed); the Playwright portion itself was only **19.8s**. Subsequent runs skip the download.
- Headless works with **no `DISPLAY`**: `scripts/run-e2e.sh` auto-exports
  `OBSIDIAN_E2E_EXTRA_ARGS="--ozone-platform=headless --disable-gpu"`. No `OBSIDIAN_PATH` needed on Linux.
- **`sleep N; cmd` in Bash is BLOCKED** by the harness. `until <check>; do sleep 10; done` with
  `run_in_background: true` also failed here (exit 3). What worked: launch the long job with
  `run_in_background: true` (it notifies on completion) **and** arm a `Monitor` tailing the log with a
  grep filter for `\[eval\]|passed|failed|Error|E2E_EXIT=`. The Monitor also emits the shell-startup
  noise as spurious events — ignore those.
- Do **not** run `npm test` concurrently with the e2e run: the e2e numbers are the timing baseline of
  record and CPU contention would corrupt them. Serialize.

## Measured baseline (buffer = 17, the default) — see PUBLIC for verbatim lines

dense is the only fixture with route-quality headroom: `maxDetourRatio=1.342 mean=1.067`
(`obstacles=101 edges=292`). sparse `1.020/1.002`, medium `1.000/1.000` — already optimal, expect them
flat across the sweep. `obstacles=101` on the dense line is the proof the heavy pass was measured and
not a stale trivial intermediate (edge-routing__04 false-pass hazard).

## Known pre-existing failure — DO NOT FIX

`src/engine/SettingsSpec.test.ts` — expects `linkStrengthFactor.max: 2`, spec ships `4`. Structurally
cannot be caused by e2e-only edits (vitest globs `src/**/*.test.{ts,tsx}`). It was the ONLY failure.

## If a future clone continues into the sweep (step 0 note)

Editing `EDGE_ROUTING_SHAPE_BUFFER_PX` (`src/view/edgeRouting.ts:71`) turns `npm test` red on
`src/view/edgeRouting.test.ts:109-131` (asserts `=== 17`). Expected; never loosen those. `npm run
build`/`test:e2e` stay green since they only run `tsc`. Copy `.out/edge-routing-force-*.png` aside per
value — filenames are fixed and get overwritten each run.

---

# STEP 1 — item (a) `setExclusive(false)` — DONE, all green, uncommitted

Public result: `STEP1_SET_EXCLUSIVE__PUBLIC.md` (same dir). Plan I followed: RED test -> one-line
change + loader type narrowing -> measure -> decide the note-pin question with evidence -> verify.

## Files touched (only these three)

- `src/view/edgeRouting.ts:266-294` — `const pin = new avoid.ShapeConnectionPin(...); pin.setExclusive(false);`
  plus a WHY block that points at the OWNERSHIP GOTCHA immediately below it. Pin never tracked, never destroyed.
- `src/view/libavoidLoader.ts:40-48, 72-86` — constructor returns the new `AvoidShapeConnectionPin`
  (`setExclusive` + `isExclusive` only; `setConnectionCost` deliberately absent, with the WHY-NOT in the doc).
- `src/view/edgeRouting.test.ts:371-533` — 3 real-wasm tests + `crowdedSideTerminals`, `hubSpokes`,
  `segmentCrosses` (Liang-Barsky), `routeCrosses`.

## THE thing a clone of me must not re-derive (cost me the most time)

**libavoid's pin-exclusivity default is derived from `visDirs`, NOT globally true.**
Measured with the freshly exposed `isExclusive()`:
- directional pin (`ConnDirLeft/...`) -> `isExclusive() === true`;
- `ConnDirAll` pin (the note centre pin) -> `isExclusive() === false`.
Consequences: (1) the ticket's "directional pins default to EXCLUSIVE" is right only for the group's 12;
(2) **explicit `setExclusive(true)` is NOT a stand-in for "today"** on note pins — I initially measured that
way and wrongly concluded there was a live obstacle-cutting bug at multi-edge notes. Always use "no call at
all" as the baseline arm in a probe.

**Exclusivity is per PIN across the whole shared-class pool.** All 12 group pins share `PIN_CLASS`, so the
group CENTRE fallback starts at the **13th** edge, not the 4th. At 8 edges the symptom is 5 of 8 terminating
on the WRONG SIDE. That is why the ticket's literal test spec (8 edges -> none at centre) is green on
unmodified code; I used 16 edges for the centre test and kept 8 for a facing-side test.

## Probe invocations (all from repo root, node, `.tmp/`, untracked)

```bash
node .tmp/probe11-reviewer.mjs          # pre-existing; A vs B, 2 corpora  -> reproduced 24->22 / 82->40
node .tmp/probe14-side-crowding.mjs     # N=4..20 one group + N left leaves; shows centre fallback at N=13
node .tmp/probe21-shipped.mjs           # probe11 corpora, variant = what is actually shipped (group+note)
node .tmp/probe22-note-ring.mjs         # 6 spokes into one hub note, blocker per spoke: 5/6 vs 0/6
node .tmp/probe24-default-vs-true.mjs   # prints isExclusive() right after construction (the key finding)
node .tmp/probe25-group-default-vs-true.mjs   # group pins: default == explicit true, both != false
node .tmp/probe26-note-default-vs-false.mjs   # note pins: default == explicit false (0 of 949 routes differ)
```
Probes print libavoid warnings on **stderr** (`no pins with class id of 1`) — `2>/dev/null` when grepping,
but that stderr volume also inflates the slow arm's `ms`, so never quote probe ms as a perf result.

## Verifying RED/GREEN of a routing change — mutation trick

vitest picks up `src/` edits immediately (no cache trap). To prove a test has teeth without reverting the
feature, mutate the production line and re-run:
`sed`/python-replace `pin.setExclusive(false)` -> `pin.setExclusive(true)` gives 3 failed / 19 passed;
-> `if (kind === "folder-group") { ... }` isolates the note-pin half (all 22 pass — that is how I proved the
note pin call is a no-op). Keep a backup: `cp src/view/edgeRouting.ts .tmp/edgeRouting.ts.bak` and restore.

## Verification actually run

`npm run check` exit 0; `npm test` exit 0 -> 63 files / 772 tests passed (the old SettingsSpec failure is
gone — main fixed it). e2e NOT run (next step). Logs: `.tmp/step1-{red,green,green2,note-red2,check,unit}.log`.

## Open ends for the next agent

- Ticket notes not updated by me; a paste-ready paragraph (with the two corrections to the ticket's own
  rationale) is in `STEP1_SET_EXCLUSIVE__PUBLIC.md` §6.
- Item (b) untouched: buffer still 17, no settings plumbing, `e2e/` untouched.
- If an e2e detour/perf number moves in step 2, note routing ms was flat here (536 -> 530 aggregate).

---

# STEP 2b — iteration on IMPLEMENTATION_REVIEW feedback (item (a)) — DONE, all green, uncommitted

Public result: `IMPLEMENTATION_ITERATION__PUBLIC.md` (same dir). All 5 feedback items INCORPORATED,
none rejected. Base commit `2d08ab1` (+ `8cdfb4a`, the review's §7.5 ticket, already on main).

## The measurement that mattered (don't re-derive)

`node .tmp/probe27-spill-threshold.mjs` — sweeps N = 1..14 on the EXACT geometry of
`crowdedSideTerminals()` in the test file, both arms (no `setExclusive` call vs `false`).
Verbatim result, reproduces the reviewer and kills the "4th edge" claim:

```
 1 L   2 LL   3 RLL   4 RLLL   5 TRLLL   6 TRLRLL   7 TTRLRLL   8 TTTRLRLL
 9 TTTRRLRLL   10 BTTTRRLRLL   11 BBTTTRLRRLL   12 BBBTTTRLRRLL
13 ?BBBTTTRLRRLL      14 ??BBTTTBRLRRLL
FIRST N with any wrong-side terminal (default) = 3
FIRST N with any group-CENTRE terminal (default) = 13
```

The `setExclusive(false)` column is `LLL…L` at every N. **Key nuance to keep:** at N=3 the LEFT side
still has 3 free pins, yet one edge lands on R — proof that libavoid assigns by globally cheapest
VISIBLE pin, not per-side first-come (the stacked leaves shadow each other's view of the left pins).
That is WHY the shipped comment now refuses to quote a per-side threshold at all. The 13th-edge
centre fallback IS a hard, structural number (12 pins) and is quoted.

## Vitest dynamic skip — the working recipe (vitest 4)

`@vitest/runner` types: `readonly skip: { (note?: string): never; (condition: boolean, note?: string): void }`.
The `never` overload is the one to use. `it.runIf(loaded)` does NOT work here: `runIf` is evaluated at
COLLECTION time, `loaded` is only known after `beforeAll` — it would always see the initial value.

Shape that type-checks under `noUncheckedIndexedAccess`/strict (copy the local-const, narrowing a
captured outer `let` directly is fragile):
```ts
function requireWasm(ctx: TestContext): Avoid {
    const instance = avoid;              // avoid: Avoid | null, module-scoped in the describe
    if (instance === null) { ctx.skip("…"); }
    return instance;                     // ctx.skip() returns never, so this narrows
}
it("…", async (ctx) => { requireWasm(ctx); … });
```
`import type { TestContext } from "vitest";` (re-exported from `@vitest/runner`).
Reporter output is `↓ … [note]` and the summary line reads `13 passed | 11 skipped (24)`.

## Proving the skip (forced-negative recipe)

```bash
cp src/view/edgeRouting.test.ts .tmp/edgeRouting.test.ts.bak
# python-replace `avoid = libavoid.AvoidLib.getInstance() as Avoid;` -> `avoid = null; void libavoid;`
npx vitest run src/view/edgeRouting.test.ts --reporter=verbose   # 13 passed | 11 skipped (24)
cp .tmp/edgeRouting.test.ts.bak src/view/edgeRouting.test.ts     # restore, then re-run to confirm 24
```
`--reporter=verbose` is REQUIRED to see the `↓` lines; the default reporter only prints the summary.

## The isExclusive() test — the wasm-teardown trap I checked first

`node .tmp/probe28-pin-default-teardown.mjs` proves a router+shape+pin arena with NO connectors can
be torn down safely both with and without `processTransaction()` (review §7.5's abort needs the
routing path). I still call `processTransaction()` before `destroy(router)` in the test helper —
cheap, and it keeps the file consistent with the arena discipline. Results (stable):
`ConnDirUp/Left -> isExclusive() === true`, `ConnDirAll -> false`.

## Files touched in 2b (five)

- `src/view/edgeRouting.ts:278-300` — the WHY block is now the SINGLE SOURCE; no per-side threshold.
- `src/view/libavoidLoader.ts:71-81` — interface doc reduced to a pointer at the call site.
- `src/view/edgeRouting.test.ts` — `loaded: boolean` -> `avoid: Avoid | null` + `requireWasm(ctx)`;
  8 guards converted; 2 new exclusivity-default tests; 2 duplicated WHY blocks reduced to pointers.
- `docs-internal/research/research-layout-aesthetics.md:121` — corrected mechanism + fan-in note.
- `docs-internal/CHANGELOG.md` — NEW dated entry; historical entry got a `[Mechanism SUPERSEDED …]`
  marker only (not rewritten).

## Verification

`npm run check` exit 0. `npm test` exit 0 -> 63 files / **774 passed** (772 before + the 2 new
exclusivity tests). Zero skips in the real run — the wasm loads here. Logs: `.tmp/s2b-*.log`.

## Still open for the next agent

- `_tickets/` untouched (TOP_LEVEL_AGENT owns it): the paste-ready notes block is in
  `STEP1_SET_EXCLUSIVE__PUBLIC.md` §6 — it says "not the 4th, at 8 edges 5 of 8 land on the wrong
  side", which is TRUE but incomplete; add "first wrong-side terminal at the 3rd edge" and the
  fan-in observation (review §7.3) when pasting.
- Item (b) (buffer sweep / settings / e2e) still untouched.
