# IMPLEMENTATION_REVIEWER — PRIVATE notes

Branch `sparse-eval-edge-flake`, diff `252700c..HEAD` (9dd84cc, 5a1b04b, b73307c).

## What I verified myself (not taken on trust)

- `git diff --stat` — production `src/` is untouched; only `src/adapters/ObsidianLinkProvider.test.ts`
  and `e2e/edgeRoutingEval.e2e.ts` plus docs/tickets. Temporary `canvasCapability` instrumentation
  is NOT left behind (grep of `src/adapters/VicinityGraphBuilder.ts` — clean).
- Root cause chain read directly:
  - `src/adapters/VicinityGraphBuilder.ts:41` — `await ObsidianLinkProvider.create(...)` per `build()`.
  - `src/adapters/ObsidianLinkProvider.ts:73` — `CanvasCapabilityDetector.detect(Object.keys(metadataCache.resolvedLinks))`.
  - `src/adapters/CanvasCapability.ts:19-27` — `core-indexed` iff some key ends `.canvas`.
  - `src/adapters/CanvasFallbackParser.ts:7,46-52` — file-type nodes only; text nodes dropped.
  - Fixture `scripts/setup-dev-vault.sh:67-76` — `test.canvas` has file nodes note1/note3 + a TEXT
    node `[[note2]]`. So the ±1 edge is exactly `test.canvas → note2.md`. Verdict CONFIRMED plugin-side.
- `npm test` → 74 files / 990 tests, exit 0 (`.tmp/rev_npmtest.log`).
- `npm run check` → exit 0 (`.tmp/rev_check.log`).
- `npm run test:e2e -- edgeRoutingEval.e2e.ts` x2 (`.tmp/rev_e2e_run1.log`, `rev_e2e_run2.log`),
  both `5 passed`, 14.5s / 14.4s, byte-identical rows:
  `sparse obstacles=13 edges=11`, `medium 21/20`, `dense 101/292`, `facing 18/27`, `PERF 101/292`.
  Matches the implementer's 5-run table. Also FASTER than the old 4×4500ms sleep.
- `grep waitForTimeout e2e/*.ts` — only `settingsResetVerify.e2e.ts:157` (200ms, pre-existing).
  The 4500ms is genuinely gone; nothing grew.

## The crux call (canvas-index precondition) — reasoning

Not a hack, for three reasons: (1) `core-indexed` is a state real users reach (it is what ~half of
boots produce, and any canvas edit produces it) — the eval is pinned to a REAL regime, not a
synthetic one; (2) the plugin bug was not masked — it was measured, escalated as a `[decide]`
ticket with a repro, and pinned by two unit characterization tests so it shows in `npm test`;
(3) the WHY/WHY-NOT is in the helper's docstring at `e2e/edgeRoutingEval.e2e.ts:116-136` including
the pointer to the decision ticket. The rejected alternative ("neutralize the fixture") was the
weaker choice and they said so.

Evidence for the "the `.canvas` key never arrives in a fallback session" claim: 8 launches, 4
misses, and on the misses a 60s poll past a settled 165-key index found nothing (2/2), plus
`canvas=0 → canvas=1` after the rewrite (2/2). That is empirical enough to justify the approach —
not "waited once".

## Things I deliberately did NOT flag as blocking

- Throwing on tied-but-disagreeing routing passes turns measurement noise into a red gate. That is
  the CLAUDE.md-correct choice (fail loudly, no silent arbitrary readout). Endorsed.
- `setAllEdgesVisibility` duplication with `edgeRouting.e2e.ts` is pre-existing and unchanged.

## Residual risks I want on record

1. The settle's condition 1 is `layoutLogs >= 2`, which assumes the bounce contributes EXACTLY one
   layout log — contradicted by the function's own docstring about a second debounced rebuild.
2. `GraphViewController.ts:213-218` (`reuse-layout`) can skip the elk log entirely, and
   `resolveRoutes` can serve cache without a routing log — either would make the settle spin to 30s
   and throw. Loud, but cryptic.
3. `ensureCanvasFixtureIsIndexed` writes to the vault, which `e2e/vaultTarget.ts:106` and the
   `obsidianHarness.ts` header say must never happen in `VICINITY_E2E_VAULT` mode.
