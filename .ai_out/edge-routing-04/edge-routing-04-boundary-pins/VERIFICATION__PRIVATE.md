# VERIFICATION — PRIVATE memory (edge-routing__04)

## Round 2 verdict: PASS (@ c060122). dense/force routing 137ms << layout ~1464ms.
- Round 1 verdict below: STOP (dense/force routing 8838ms >> layout ~1450ms; ~64x base).

## Round 2 (group-only pins + telemetry fix) — commands + numbers
- HEAD `c060122` "fix(edge-routing__04): group-only boundary pins + accurate routing telemetry".
- `npm run test:e2e -- edgeRoutingEval.e2e.ts > .tmp/eval-fixed.log 2>&1` → 6 passed (29.2s).
  Grep `[eval]` for the per-fixture numbers; grep `✓`/`passed` for verdicts.
- [eval] force: sparse 2.9/34.4 (obs13), medium 9.4/35.6 (obs21), dense 137.2/1463.6 (obs101).
  layered/dense 174.3/300.8. radial routingMs=undefined (gated). PERF dense/force 125.7 < 1495.1 obs101.
- PERF test now TRUE-passes: measured pass has obs=101 (telemetry reorder = clip+detourStats+debug
  moved BEFORE isStale early-return, so heaviest non-stale pass logs). Round-1 false pass (obs=3) closed.
- Detour ratios via throwaway `e2e/zzThrowawayDetour.e2e.ts` (DELETED): reused ObsidianHarness,
  onConsole captured msg.args()[1].jsonValue(), printed full payload. medium max=mean=1.0;
  dense max 3.096 mean 1.161. (Same reason as Round 1: page console.debug NOT forwarded to stdout.)
- Screenshots regenerated in .out/edge-routing-force-{sparse,medium,dense}.png etc. Eyeballed:
  medium/sparse group boxes attach facing-side, direct, no loops vs base-*.png loops. PASS.
- Did NOT modify src/, did NOT commit, throwaway spec removed, `git status` clean.

---

# Round 1 memory (below)

## Verdict: STOP (dense/force routing 8838ms >> layout ~1450ms; ~64x base).

## Environment
- Obsidian 1.12.7 binary already cached at
  `.tmp/obsidian/obsidian-1.12.7/obsidian` (199MB). No display -> run-e2e.sh
  auto-sets `--ozone-platform=headless --disable-gpu`. OBSIDIAN_PATH unset by
  default; run-e2e resolves it via setup-obsidian-bin.sh (cache hit, no download).
- Bash shell prints a big noisy vintrin/zellij env preamble on EVERY command;
  ignore it. grep -v it when scanning logs.

## Commands run
- `npm run test:e2e -- edgeRoutingEval.e2e.ts > .tmp/eval-new.log 2>&1` (NEW). 6 passed.
- Temp spec `e2e/zzdetourVerify.e2e.ts` (deleted): printed detour ratios per
  fixture (committed eval's onConsole captures maxDetourRatio in msg.args()[1]
  but the [eval] console.log lines omit them; page console.debug is NOT forwarded
  to Playwright stdout, so you cannot grep the raw debug lines from the log —
  had to add my own console.log in a spec).
- Temp spec `e2e/zzdenseSettle.e2e.ts` (deleted): dense-only, force, 30s settle,
  printed EVERY routing pass -> caught the 101-obstacle pass at 8838ms.
- BASE via `git worktree add .worktree/base main`, symlinked node_modules from
  main repo, exported OBSIDIAN_PATH to the cached binary. Removed with
  `git worktree remove .worktree/base --force` (also rm'd the node_modules symlink first).

## Key gotchas / root cause of the "false pass"
- `GraphViewController.resolveRoutes()` line 267-268: `if (isStale(token)) return
  EMPTY_ROUTES;` sits BEFORE the `console.debug("...edge routing pass"...)` at
  280. So a superseded (stale) dense pass logs nothing. On main the debug line was
  before the stale check -> always logged (that's why BASE shows obstacles=101,
  NEW shows only obstacles=3). Net effect: the committed PERF BUDGET e2e test
  measures a tiny intermediate 3-obstacle pass on NEW and vacuously passes.
- To get the real number you MUST let the graph fully settle (30s) and capture
  ALL passes, taking the obstacles=101 one. It is genuinely ~8.8s (not wasm cold
  start — it's the LAST/slowest pass; cold start would hit the first).
- Dense fixture = zzdense-hub.md, 110 spokes, 101 obstacles / 292 edges (built by
  scripts/setup-dev-vault.sh). Medium = hub-medium.md, 5 folder groups.

## Numbers (force)
- BASE: sparse 1.9ms, medium 5.4ms, dense 137.7ms (obs101).
- NEW:  sparse 11.8ms, medium 64.8ms, dense 8838.2ms (obs101, maxDetour 3.257).
- Scaling base->new: ~6x @13obs, ~12x @21obs, ~64x @101obs. Super-linear in pins.

## Detour ratios (NEW)
- sparse/medium: max=mean=1.0 (perfect). dense: max 3.257, mean 1.181.
- BASE has NO detour telemetry (main lacks it) -> before ratios unmeasurable;
  before/after quality is VISUAL only (base-force-medium loops, new is direct).

## Exact-repro (public vault): not automated. Harness hardcodes DEV_VAULT_DIR,
  no override; would need committed harness change -> skipped per task. Covered by
  force-medium grouped fixture + detour metric.

## Artifacts left (not source-controlled, fine): .out/edge-routing-*.png,
  .out/new-*.png, .out/base-*.png. Logs in .tmp/eval-new.log, .tmp/detour-new.log,
  .tmp/dense-settle-new.log, .tmp/eval-base.log.
## Did NOT modify src/. Did NOT commit. Temp e2e specs deleted; worktree removed.
