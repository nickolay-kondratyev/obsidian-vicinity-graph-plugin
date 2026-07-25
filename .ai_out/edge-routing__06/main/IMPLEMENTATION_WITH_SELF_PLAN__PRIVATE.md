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

---

# STEP 4 — the `facing` dev-vault fixture (edge-routing__06) — DONE, all green, uncommitted

Public result: `STEP4_FIXTURE__PUBLIC.md` (same dir). Two files touched, both outside `src/`:
`scripts/setup-dev-vault.sh:240-291` and `e2e/edgeRoutingEval.e2e.ts:21-23,:175`.
`npm test` 774/774, `npx tsc -p e2e/tsconfig.json --noEmit` 0, `test:e2e -- edgeRoutingEval` 5 passed.

## The headline a clone must not re-derive

**The symptom does NOT reproduce on shipped code — because item (a) already fixed it.**
Same fixture, two arms, exact terminal points read out of the DOM (box rect `855,506 → 1232,736`,
neighbour blob entirely ABOVE the box, so TOP is the facing side):

```
shipped (pin.setExclusive(false)):  TOP@1044 x11 , TOP@950 x1                    -> 12/12 facing
pre-(a) (that line removed):        TOP x7 (7 distinct x) , LEFT@855 x3 ,
                                    RIGHT@1232,564 x1 , BOTTOM@1044,736 x1        -> 2 far-side wraps
```
The 7 distinct TOP x-values in the pre-(a) arm are the CENTRE fallback (12 exclusive pins all
claimed) clipped at the border by the render-time clip — not 7 pins. There are only 3 pins/side.

**`[eval]` cannot see this.** At the earlier N=8 geometry both arms printed byte-identical
`maxDetourRatio=1.079 meanDetourRatio=1.014`. Detour ratio is blind to which side an edge lands on.
Never report a flat `[eval]` line as evidence of correct attachment.

## Fixture design decisions (and why)

- Central note lives INSIDE the group (`facing/hub-facing.md`). That is what turns every
  hub→neighbour link into a cross-boundary edge collapsed onto the BOX. Precedent: the ticket-03
  stranding fixture already opens a grouped central note (`p/ep/stranded-hub.md`), so this is not
  novel behaviour. Depth default is 1/1 (`SettingsSpec.ts:107-109`) — hence everything must be one
  hop from the hub; that is why the neighbours link the hub rather than each other's chain.
- Collapse unions by UNORDERED PAIR (`flowMapping.ts:206-257`) → distinct neighbours = distinct
  edges. Same neighbour linking 2 members would be ONE edge with count 2, not two edges.
- Neighbours are ROOT notes (root is never a folder group — same trick zzdense uses).
- `facing-near1` as the cluster mini-hub is the whole reason the blob is compact and the facing side
  unambiguous. Without it (or with a chain) the blob straddles two sides.

## Geometry iteration — N=8 was measured and REJECTED

N=8: 4 LEFT / 3 BOTTOM / 1 TOP over 6 terminals, fan-in x2, `maxDetourRatio=1.079`
(counterfactual still produced one RIGHT wrap, so it did work — just weakly).
N=12: all 12 on TOP, fan-in **x11**, `maxDetourRatio=1.310` — second-highest of all four fixtures,
so this is the only OTHER fixture besides dense with route-quality headroom for the step-5 sweep.
Kept 12 even though the brief suggested 5-8. One constant: `setup-dev-vault.sh:261`.

## Traps that cost me time

- **`write_if_missing` never overwrites.** Changing `FACING_NEIGHBOUR_COUNT` does nothing until you
  `rm -rf .dev-vault/facing .dev-vault/facing-near*.md`. Deleting only `facing-near*.md` is NOT
  enough — `facing/hub-facing.md` holds the link list and is what actually sets the count.
- `e2e/tsconfig.json` has no `downlevelIteration`/ES2015 iteration for DOM collections: spreading a
  `NodeListOf<…>` fails with TS2488, and `[...map.entries()]` would too. Index loops + a
  `Record<string, number>` work.
- No PIL in this env; **ImageMagick `convert` IS available** — `convert in.png -crop WxH+X+Y +repage
  -resize 400% out.png` is how I zoomed into the border to eyeball terminals.
- The eval screenshot is the sidebar-sized `.vicinity-graph-flow` locator (476x716), while the probe
  reports WINDOW coordinates (the pane starts at x≈791/791+, y≈54). Offsets differ per layout — do
  not assume the 791/54 offsets transfer.

## The terminal probe (parked, reusable)

`.tmp/zzFacingTerminalsProbe.e2e.ts.keep` — copy to `e2e/` to re-run, delete after. It prints
`[probe] {groupRect, edgePathCount, terminalCount, distinctTerminals:["SIDE@x,y xN"]}` by reading
`getPointAtLength(0|len)` through `getScreenCTM()` and classifying against
`.vicinity-graph-group[data-folder="facing"]`'s client rect (6px tolerance). Runs in 5.7s.
**Step 5 should re-run this at buffer 11** — it is the only readout that sees attachment side.

## Mutation discipline (I did touch src/, temporarily)

`cp src/view/edgeRouting.ts .tmp/edgeRouting.ts.bak` → python-replace `pin.setExclusive(false);`
with `void pin;` → measure → restore → `git diff --stat src/ | wc -l` == 0. Did this twice (N=8 and
N=12 arms). Final tree has `src/` byte-identical to HEAD. Declared in the PUBLIC §6.

## Still open

- `_tickets/` untouched (TOP_LEVEL_AGENT owns it). Three `#QUESTION_FOR_HUMAN:` in PUBLIC §7 —
  the important one is Q1: if the human's real vault still wraps WITH item (a) shipped, this
  fixture does not model their case and we need the real box aspect ratio + neighbour count.
- Buffer still 17. Step 5 owns lowering it to 11 and capturing AFTER (screenshot + probe + `[eval]`).

---

# STEP 5a — item (b) CORE: constants, invariants, engine setting, plumbing — DONE, all green, uncommitted

Public result: `STEP5A_CORE__PUBLIC.md` (same dir). Base commit `3786495`. 17 `src/` files touched.
`npm run check` exit 0; `npm test` 63 files / **779 passed** (baseline 774 — measured by stashing);
`npx tsc -p e2e/tsconfig.json --noEmit` exit 0. e2e NOT run (step 5b owns the AFTER measurement).

## Final names (and why) — do not rename on a later pass

- Engine field: **`edgeRoutingClearancePx`** (NOT the suggested `edgeClearancePx`).
  `types.ts:194-201` states the rule outright: force-layout field NAMES describe the MECHANISM, the UI
  shows the label. `elkNodeSpacingPx` names its subsystem (elk), so this one names its subsystem too
  (the edge-routing pass). The UI label is still exactly "Edge clearance" (D4).
- Routing-input field: **`shapeBufferPx`** on `EdgeRoutingInput` — libavoid's own parameter name
  (`avoid.shapeBufferDistance`) and the retired constant's name. The JSDoc on both sides ties them.

## The two design calls a clone must not re-litigate

1. **The value travels IN `EdgeRoutingInput`, not as a second `route()` argument.** That is what makes
   `routingSignature` cover it for free (`GraphViewController.ts:381` prepends `String(input.shapeBufferPx)`).
   A `route(input, px)` shape would have left the cache trap wide open.
2. **`min: 6` is INCLUSIVE, so the invariant is `>=`, not `>`.** D3's prose says "assert min > 6" but
   D3's own decided range is 6-14 and SWEEP §7 calls 6 "the arrowhead half-width floor". `>` and
   `min: 6` cannot both hold. I kept the human's RANGE and used `toBeGreaterThanOrEqual`, with the
   boundary case stated in the test comment (at the floor the head's body grazes, never crosses).
   Flagged in PUBLIC §7 as the one deviation-shaped call.

## The RED-first evidence (verbatim, `.tmp/s5a-red1.log`)

Both new controller tests were written and run BEFORE any plumbing existed:
```
× WHEN a build routes THEN the graph's resolved edge-routing clearance reaches the router
  → expected undefined to be 7 // Object.is equality
× WHEN only the edge-routing clearance changed THEN the router runs again (the cache signature covers it)
  → expected 1 to be 2 // Object.is equality
Tests  2 failed | 37 passed (39)
```
`expected 1 to be 2` IS the cache trap reproducing: both rebuilds have identical obstacle geometry
(FakeLayout is deterministic), so a geometry-only signature served the stale routes.

## Invariant teeth, proven by mutation (`.tmp/s5a-mutate.log`)

Temporarily widened the spec to `min: 5, max: 16` → `2 failed | 22 passed (24)`, one failure per
invariant. Restored from `.tmp/SettingsSpec.ts.bak`; `git diff` shows only the intended 29 insertions.

## Traps worth knowing

- **`src/view/testFixtures/graphFixtures.ts:52` hand-lists `forceLayout`** — it is NOT in any exploration
  table but `tsc` catches it (TS2741). It ships `collidePaddingPx: 20`, deliberately not the default.
- **Importing `./VicinityEdge` (a `.tsx` pulling `@xyflow/react`) into the node-env `edgeRouting.test.ts`
  works.** I expected trouble and had a fallback ready (move the constant to the pure `edgeGeometry.ts`);
  it was not needed. If a future vitest/RF upgrade breaks it, that fallback is the move.
- **`GraphStructureDiff.test.ts` gained a test for free** (16 → 17): it iterates `FORCE_LAYOUT_FIELDS`,
  so the relayout-on-change coverage for the 7th field is automatic. Per-file counts diffed with
  `--reporter=json` into `.tmp/s5a-{base,now}.json` — much cheaper than eyeballing.
- **`elkMapping.test.ts:99` was tautological** (`toBe(ELK_GROUP_PADDING)`), so it could not have caught a
  broken rebuild of the elk string. Added a literal lock next to it.
- **`FORCE_LAYOUT_FIELD_META` is a compile-time exhaustive `Record`** — leaving it to step 5b would have
  meant shipping a RED `npm run check`. Adding it was forced, not scope creep; the copy follows D4.

## Still open after me

- Everything in the PUBLIC HANDOFF list (settings tab is already wired by inheritance — 5b VERIFIES it,
  it does not need to add a row). The ONLY known red surface left is `e2e/settingsUxVisual.e2e.ts:96`
  `toHaveCount(6)`. `src/view/settingsResetPlan.ts:94` and `README.md:71` say "six" and are now WRONG
  but have no test asserting the word, so they are silent — 5b must not rely on a failure to find them.
- `docs-internal/CHANGELOG.md` untouched by me.
