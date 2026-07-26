# IMPLEMENTATION REVIEW — sparse eval `edges=` flake (`nid_li45606h8uvcnjm7fss17xl1u_e`)

Branch `sparse-eval-edge-flake`, diff `252700c..HEAD` (`9dd84cc`, `5a1b04b`, `b73307c`).

## Summary

The eval spec's sparse row flipped `edges=10 ↔ 11` run-to-run. This change:

- **`e2e/edgeRoutingEval.e2e.ts`** — new `ensureCanvasFixtureIsIndexed()` precondition in
  `beforeAll`; `waitForTimeout(4500)` replaced by a condition-driven
  `waitForRebuildBurstToSettle()`; `lastDurations` → `settledMetrics`, which reports the LAST
  heaviest pass and throws when equally-heavy passes disagree on `edgeCount`.
- **`src/adapters/ObsidianLinkProvider.test.ts:140-174`** — two BDD characterization tests pinning
  the regime divergence.
- **`_tickets/…decide-canvas-link-regime…md`** (`nid_s676x55uojmtcwh9t4l9mc6zl_e`) — the escalated
  plugin bug; originating chore closed with a note.

**Overall: sound, honest work.** The root-cause verdict is correct and I re-derived it from the
code rather than trusting the report. No production behaviour changed. No fixed timeout grew — the
suite got *faster*. Three non-blocking robustness/scope items below.

### Independent verification (I ran these, not the implementer)

| Check | Result |
|---|---|
| `npm test` | exit 0 — 74 files / 990 tests (`.tmp/rev_npmtest.log`) |
| `npm run check` | exit 0 (`.tmp/rev_check.log`) |
| `npm run test:e2e -- edgeRoutingEval.e2e.ts` run 1 | `5 passed (14.5s)` |
| `npm run test:e2e -- edgeRoutingEval.e2e.ts` run 2 | `5 passed (14.4s)` |

Both runs, byte-identical:

```
[eval] force/sparse: obstacles=13 edges=11 maxDetourRatio=1.007 meanDetourRatio=1.001
[eval] force/medium: obstacles=21  edges=20  maxDetourRatio=1.000 meanDetourRatio=1.000
[eval] force/dense:  obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046
[eval] force/facing: obstacles=18  edges=27  maxDetourRatio=1.266 meanDetourRatio=1.047
[eval] PERF dense/force: obstacles=101 edges=292 maxDetourRatio=1.244 meanDetourRatio=1.046
```

These match the implementer's reported 5 runs exactly. The claim holds up.

### Root cause — independently confirmed, correctly attributed

Read directly, not taken on trust:
`src/adapters/VicinityGraphBuilder.ts:41` builds a NEW provider per `build()` →
`src/adapters/ObsidianLinkProvider.ts:73` calls
`CanvasCapabilityDetector.detect(Object.keys(metadataCache.resolvedLinks))` →
`src/adapters/CanvasCapability.ts:19-27` returns `core-indexed` iff some key ends `.canvas`.
`src/adapters/CanvasFallbackParser.ts:7,46-52` keeps file-type nodes only. The fixture
(`scripts/setup-dev-vault.sh:67-76`) has a TEXT node `[[note2]]`, so the ±1 edge is exactly
`test.canvas → note2.md`. **Plugin-side, per-session boot race — stated correctly and honestly.**
The report is also honest that the harness tie-break contributed nothing and was fixed anyway.

### The crux: is forcing the canvas index a hack? — No.

Judged carefully, it is a legitimate deterministic precondition, not a mask:

1. It pins the eval to `core-indexed`, a state **real users reach** (roughly half of boots, and any
   canvas edit) — not a synthetic state no one can observe.
2. The plugin bug is **not buried**: measured with a 5/5 correlation table, escalated as a
   `[decide]` ticket with a repro, and pinned by unit tests so it surfaces in `npm test`.
3. The WHY/WHY-NOT is in the docstring at `e2e/edgeRoutingEval.e2e.ts:116-136`, with the ticket id.
   A maintainer in six months will understand it.
4. The rejected alternative (ship a canvas without the text-node wikilink) was correctly identified
   as the weaker choice — it would quietly hollow out the fixture.

The strong claim justifying the approach ("in a fallback session the `.canvas` key NEVER arrives")
is backed adequately: 8 launches / 4 misses, and on the misses a 60s poll past a fully settled
165-key index still found none (2/2), with `canvas=0 → canvas=1` after the rewrite (2/2). That is
evidence, not "I waited 60s once".

### Timeouts

`grep waitForTimeout e2e/*.ts` → the only remaining one is the pre-existing 200ms in
`settingsResetVerify.e2e.ts:157`. **4500ms is genuinely gone**, and total wall-clock dropped from
~22.5s of guaranteed sleep to a 14.4s run. `SETTLE_QUIET_MS = 1_500` is a quiescence window, but it
is gated behind a state condition and cannot short-circuit while the central layout is pending
(see the caveat below), so it is not a sleep in disguise.

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

### 1. SHOULD-FIX — the settle gate contradicts its own docstring (`e2e/edgeRoutingEval.e2e.ts:50, 184-212`)

`LAYOUTS_PER_FIXTURE_RENDER = 2` encodes "the bounce logs exactly ONE layout". But the same
function's docstring (lines 184-186) says *"opening a note fires several rebuilds (the immediate
`file-open` one, then the 500ms-debounced `metadataCache "resolved"` one), each logging a layout
and a routing pass"*. If that ever holds for the BOUNCE note, condition 1 is satisfied by bounce
passes alone, and the 1.5s quiet window can then elapse during the dense fixture's silent ~1.4s elk
run — i.e. exactly the regression fixed in `5a1b04b` returns, and it returns *silently* (a wrong
`obstacles=3 edges=4` dense row, not a failure).

Today it works because nothing modifies files during the test bodies, so each open yields one
rebuild. That is an implicit environmental assumption, not a guarantee.

**Suggested fix (cheap):** make the gate content-based instead of count-based — require a layout
pass strictly heavier than the first (bounce) one, e.g. `captured` contains a `layout` entry whose
`nodeCount` exceeds the first layout entry's. That is true by construction for all four fixtures
(bounce `note2.md` is the smallest vicinity in every case) and survives an extra bounce rebuild.
Alternatively add the central path to the controller's debug payload and match on it exactly.

Either way, please reconcile the docstring and the constant — one of them is currently wrong.

### 2. SHOULD-FIX — the settle silently depends on the plugin always emitting a layout log

`src/view/GraphViewController.ts:212-218`: when `decideLayout(...) === "reuse-layout"` the elk pass
is **skipped** and a *different* line is logged (`"structural diff skipped elk layout"`), which the
spec's `onConsole` ignores. Similarly `resolveRoutes` returns cached routes without logging when the
routing signature is unchanged. If either path is taken for a central fixture, the settle can never
reach 2 layout logs, spins for `SETTLE_TIMEOUT_MS = 30_000`, and throws
`Rebuild logs never settled` — a cryptic 30s-per-fixture failure for someone who merely retuned
`SIZE_RELAYOUT_THRESHOLD`.

It fails loudly rather than lying, so this is not blocking. But the coupling should be stated in the
`waitForRebuildBurstToSettle` docstring ("assumes the central rebuild is structural, so elk runs and
logs"), and the throw message should name the missing condition (e.g. "central layout pass never
logged — did the rebuild take the reuse-layout path?").

### 3. SHOULD-FIX — the new precondition writes to the vault, which override mode forbids

`ensureCanvasFixtureIsIndexed` calls `app.vault.modify(...)` (`e2e/edgeRoutingEval.e2e.ts:149`).
This bypasses two explicit, documented invariants:

- `e2e/vaultTarget.ts:106` rejects `extraFixtures` under `VICINITY_E2E_VAULT` precisely because
  *"writing fixture notes would mutate the vault"*.
- `e2e/obsidianHarness.ts` header: override mode = *"no copy, no wipe, no fixture writes"* — now
  false for this spec.

With `VICINITY_E2E_VAULT` pointed at a real vault, this spec will append a newline to that user's
`test.canvas` (or throw). The spec is already dev-vault-specific (`note1.md`, `hub-medium.md`, …) so
it was never meant to run there — make that structural rather than incidental:

```ts
test.skip(process.env[VAULT_OVERRIDE_ENV_VAR] !== undefined,
  "eval fixtures + the canvas-index precondition are dev-vault specific");
```

That restores the harness's "no fixture writes" guarantee by construction.

## 💡 Suggestions

- **NIT** `e2e/edgeRoutingEval.e2e.ts:211` — `passesCaptured=[${pendingPerf.length}]` counts
  *promises* (including the ones that resolve to `null`), not captured passes. Use the resolved
  `captured.length` from the loop so the diagnostic doesn't mislead.
- **NIT** `setAllEdgesVisibility` is still duplicated between `edgeRoutingEval.e2e.ts:159` and
  `edgeRouting.e2e.ts:109`. Pre-existing and **not made worse** here; worth a small ticket to lift it
  into a shared e2e helper rather than fixing in this chore.
- **NIT** Once `nid_s676x55uojmtcwh9t4l9mc6zl_e` is decided as "text-node wikilinks produce no edge",
  the sparse row re-baselines to `edges=10` and `ensureCanvasFixtureIsIndexed` becomes vestigial.
  Adding that to the ticket's Acceptance Criteria would stop the helper outliving its reason.

### Explicitly endorsed (no change wanted)

- `settledMetrics` **throwing** on equally-heavy passes that disagree on `edgeCount` is the right
  call — CLAUDE.md forbids silent fallbacks, and an arbitrary stable-sort readout is exactly the lie
  this ticket existed to remove.
- The two characterization tests are honest: BDD `WHEN … THEN …`, one behaviour each, they pin
  **both** regimes, and the header (`ObsidianLinkProvider.test.ts:140-147`) states plainly that
  neither asserts a preference and points at the decision ticket. They do **not** lock in a side of
  the deferred product decision.
- The `[decide]` ticket is genuinely self-contained: `[decide]` in the title per CLAUDE.md, exact
  file paths, the 5-run measurement table, a reproduction, the product question stated as a binary,
  two candidate fixes with a recommendation, an explicit "do not change semantics without the human
  decision", and acceptance criteria. A human can decide from it without re-deriving anything.
- Scope stayed a test-harness chore: `src/` production code is byte-identical to the branch point,
  and the temporary `canvasCapability` instrumentation was removed. No behaviour-capturing tests or
  `ap_XXX_E` anchors were removed. The self-reported regression in `5a1b04b` (quiescence-only settle
  publishing the bounce pass as the dense row) was disclosed rather than buried — that is the
  transparency the standards ask for.

## Documentation Updates Needed

None required. `CLAUDE.md` and `docs-internal/` need no change — the eval spec's own header carries
the knowledge, and the plugin-side product question lives in its ticket where it belongs.

## VERDICT: READY

Ships as-is. The three items below are follow-ups, not gates; #1 and #3 are worth doing before the
next e2e touch.

1. **SHOULD-FIX** — reconcile `LAYOUTS_PER_FIXTURE_RENDER = 2` with the docstring at
   `e2e/edgeRoutingEval.e2e.ts:184-186`; prefer a content-based gate (a layout heavier than the
   bounce's) so an extra bounce rebuild cannot silently republish the bounce pass.
2. **SHOULD-FIX** — guard the spec with `test.skip` under `VICINITY_E2E_VAULT`, restoring the
   harness's documented "no fixture writes in override mode" invariant broken by
   `edgeRoutingEval.e2e.ts:149`.
3. **SHOULD-FIX** — document the settle's dependency on the elk layout log actually being emitted
   (`GraphViewController.ts:212-218` `reuse-layout` skips it) and make the timeout message name the
   unmet condition.
4. **NIT** — `passesCaptured` should report resolved passes, not pending promises
   (`edgeRoutingEval.e2e.ts:211`).
5. **NIT** — ticket the pre-existing `setAllEdgesVisibility` duplication across the two routing specs.
6. **NIT** — add eval re-baselining to `nid_s676x55uojmtcwh9t4l9mc6zl_e`'s acceptance criteria.
