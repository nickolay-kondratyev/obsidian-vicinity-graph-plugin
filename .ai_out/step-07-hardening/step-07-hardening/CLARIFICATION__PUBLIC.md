# CLARIFICATION__PUBLIC — step-07-hardening

All open items resolved with human (2026-07-20).

## Decisions

**1. Perf budgets.** Assert **determinism + skip-invariants + chunk-yield structurally** (robust across machines). Keep ONE loose wall-clock ceiling:
- Engine `build()` at cap=100 over dense fixture (~500 pre-truncation nodes): **< 150 ms** (generous, regression guard only).
- Unchanged structure → `decideLayout` skips elk (**0 elk calls**) — hard invariant.
- Orphan sweep over **500 doc-data files** → chunk-yield count > 0 (batch=20) — structural, not wall-clock.

**2. Fixture generator: COMMITTED** deterministic TS generator under `src/engine/testFixtures/` producing `FakeVaultSpec`s (hub 200+ links, deep chains, bidirectional clusters, folders 1/2/many, canvas-heavy). Regression harness for V2.

**3. Test split.** Keep dense suite in default `npm test` (it's pure engine, fast). Only split to `test:heavy` if measurably slow — decided by measurement, default keep.

**4. Fix-now vs ticket.**
- **FIX NOW:** `_tickets/hover-pin-button-blankets-tiny-nodes-and-eats-the-open-click` (CSS: `pointer-events:none` while hidden + size-threshold hide).
- **KEEP TICKETED:** pinned-central-status-lags-after-restart, controls-optimistic-input-latency, eslint-adoption, e2e-flaky-headless, folder-color, dev-vault-thumbnail, e2e-view-type-dedup.
- Perf findings from measurement → fix if cheap, else ticket.

**5. README / release.**
- **License:** state **KSAL-2.3** plainly, keep short, refer to `LICENSE.md` as the authority. Do NOT relicense.
- **Plugin id `obsidian-neighborhood-graph`:** KEEP as-is for V1. A later round will rename to "vicinity graph" and move to a different repo — do not rename now.
- **Store submission:** OUT OF SCOPE. Produce release checklist only (repo move coming anyway).

## Execution plan (phased to avoid compaction; code agents serial)
- **PHASE A** — Engine dense-fixtures + cap edge cases (test-only + committed generator).
- **PHASE B** — Performance pass: rebuild-debounce test, orphan-sweep scale-up test, image-loading/culling investigation+fix-or-ticket, hover-pin CSS fix.
- **PHASE C** — README rewrite + release checklist + ticket triage (create/close tickets).

Each phase: IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → ITERATION → commit.
