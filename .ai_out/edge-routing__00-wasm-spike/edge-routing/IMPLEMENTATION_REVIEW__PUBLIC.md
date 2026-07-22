# Phase 0 spike — libavoid-js WASM in Obsidian — IMPLEMENTATION REVIEW

Reviewer: IMPLEMENTATION_REVIEWER sub-agent. Commit reviewed: `5c6685b` (branch `edge-routing`, clean tree).
Ticket: `_tickets/edge-routing__00-wasm-spike-libavoid-in-obsidian.md`.
Verification logs: `.tmp/{check,vitest,spike,build,e2e}.log`.

## Overall verdict: READY TO CLOSE

The spike meets its de-risk bar. I independently reproduced every claim, including the
highest-risk one (offline load inside real Obsidian/Electron) — the e2e RAN AND PASSED on
this machine. No BLOCKING findings. Two IMPORTANT follow-ups, both bookkeeping / Phase-1
API decisions rather than technical defects in the spike itself.

- BLOCKING: 0
- IMPORTANT: 2
- NIT: 5

## Acceptance-criteria verdict table (evidence I personally observed)

| # | Criterion | Verdict | Evidence I observed |
|---|-----------|---------|---------------------|
| 1 | `npm run build` produces `main.js` with embedded wasm; loads OFFLINE in Obsidian, network disabled | **PASS** | `npm run build` exit 0; `wc -c main.js` = **2,607,082** (matches report to the byte); `data:application/octet-stream;base64,` prefix present; wasm mid-slice (`base64 \| cut -c100000-100080`) → EMBEDDED. Offline: e2e below. |
| 2 | Scenario (a) routes around obstacle | **PASS** | `libavoidSpike.test.ts` scenario (a) green; asserts `pointCount>2` AND no vertex strictly inside the rect — a straight 2-point line would fail `>2`, so the assertion genuinely requires a bend. Real, not hollow. |
| 3 | Scenario (b) nested-shape documented | **PASS** | Green in vitest + e2e; asserts start-at-child-centre, `pointCount>2`, avoids the outside blocker. Behavior documented in report as "works, no attach-to-group fallback needed." |
| 4 | Scenario (c) 100× create/destroy no crash | **PASS** | `runStressLoop` genuinely loops 100×, each iteration builds+disposes a fresh router; asserts `completed===100`. Any throw would fail the test. |
| 5 | Findings + measured `main.js` size delta recorded ON TICKET via `ticket add-note` | **FAIL (partial)** | Findings live in `.ai_out/...PUBLIC.md`; the ticket file itself has NO notes section. Report marks this `[x]` but softens to "(ticket note attempted — see PRIVATE)". Substance exists, but the literal criterion — recorded *on the ticket* — is unmet. See I1. |
| 6 | `npm run check` + vitest suite still pass | **PASS** | `npm run check` exit 0 (tsc clean); `npx vitest run` = **616 passed / 54 files** (612 pre-existing + 4 spike). No regressions. |

### Offline-in-Obsidian (the core de-risk) — independently reproduced
I ran `OBSIDIAN_PATH=$PWD/.tmp/obsidian/obsidian-1.12.7/obsidian bash scripts/run-e2e.sh
libavoidSpike.e2e.ts` → exit 0, **`1 passed (48ms)`** (`.tmp/e2e.log`). The harness
(`e2e/obsidianHarness.ts`) spawns the REAL pinned Obsidian 1.12.7 Electron binary and drives
it over CDP — not a node stub. The test installs a renderer network blackhole
(`page.route` aborting all `http(s)`/`ws`) BEFORE running the command, then asserts the wasm
loaded and all three scenarios routed. Since a `data:` URL is not a network request, success
under the blackhole is a valid offline proof: had the engine needed any network fetch, the
abort would have failed the load. This claim is fully backed.

## Loader-shim quality (`src/view/libavoidLoader.ts`) — the one production artifact Phase 1 builds on

Good: clean public surface (`loadAvoid(): Promise<Avoid>`, lazy, singleton-cached via a
module `cached` promise so concurrent callers share one init — no double-load race). Focused,
honestly-documented `Avoid` interface narrowing an untyped lib. Error path is explicit (throws;
comment states callers fall back to straight edges). Memory-ownership rule ("never destroy
router-owned ShapeRef/ConnRef/pins") is correctly encoded in `AvoidArena` and empirically holds
(100× loop, no double-free). See I2 and N1 below.

## Findings

### IMPORTANT

- **I1 — Acceptance criterion 5 literally unmet: no `ticket add-note`.**
  The size delta / load-path / nested-shape / mobile findings are in the `.ai_out` PUBLIC doc,
  but `_tickets/edge-routing__00-wasm-spike-libavoid-in-obsidian.md` has no notes and its
  checkboxes are unchecked. The self-plan marks the box `[x]`. *Fix:* run `ticket add-note` on
  the ticket recording `main.js` +729,373 B (1,877,709 → 2,607,082), load path = data-url,
  nested-shape = works (no fallback), mobile = not verified (best-effort); then tick the boxes.
  Non-technical, trivially fixed — does not block the spike's conclusion.

- **I2 — `loadAvoid()` caches a REJECTED promise permanently** (`libavoidLoader.ts:87-100`).
  If `initAvoid()` throws, `cached` holds the rejection for the process lifetime; every later
  `loadAvoid()` re-throws without retry, so once the engine fails all views get straight edges
  for the whole session. For a *deterministic* bundle failure (bad embed / Electron rejects
  `data:` wasm) this is arguably the RIGHT behavior (no futile retries), but it is undecided and
  undocumented — the doc comment says "throws" but not "permanently sticky". Since this is the
  exact shim Phase 1 depends on, *decide deliberately*: either reset `cached = null` on failure
  to allow a later retry, OR add a one-line WHY comment stating the stickiness is intentional.

### NIT

- **N1 — Leak-safe `AvoidArena` lives in the THROWAWAY spike** (`libavoidSpike.ts:40-87`), slated
  for deletion in Phase 1, yet it encodes the load-bearing ownership contract Phase 1 most needs.
  The report says "recommend Phase 1 promote it." Make that a tracked Phase-1 action so it is
  promoted to production, not deleted-then-reinvented.

- **N2 — `loadPath: "data-url"` is hardcoded** in `main.ts:193` and asserted in the e2e
  (`libavoidSpike.e2e.ts:70`). The loader has only one path, so the assertion is tautological —
  it proves a constant, not a detected path. The value is *accurate* (only data-url exists), so
  this is honest, but the e2e "loadPath" assertion carries less weight than it appears.

- **N3 — Obstacle avoidance is checked on polyline VERTICES only** (`isStrictlyInside` per point),
  not on segments; a segment could in principle clip a rect between two outside vertices. With
  `shapeBufferDistance` clearance and the `pointCount>2` co-assertion this is an acceptable proxy
  for a spike — noted as a known limitation, not a defect.

- **N4 — `Avoid` interface index signature** `readonly [key: string]: unknown`
  (`libavoidLoader.ts:47`) weakens type-safety, but is a pragmatic response to an untyped lib.

- **N5 — `loadAvoid` is a module-level free function** with module `cached` state. CLAUDE.md
  disfavors non-private free-floating functions; here it is an acceptable module-singleton, but
  Phase 1's `LibavoidEdgeRouter` may want to wrap it behind an injected interface for DIP.

## Honesty audit

The PUBLIC report is largely accurate and, where it hedges, hedges correctly. Byte-exact size
delta, 616-test count, and the offline e2e all reproduced. Mobile is honestly recorded as NOT
verified (best-effort). The `wasmBinary`-fallback-unreachable characterization matches the code.
The single overstatement is criterion 5's `[x]` (findings recorded "on this ticket") when the
ticket carries no note — softened but still marked done. Scope discipline is clean: only the
9 expected files + 2 `.ai_out` docs changed; no GraphViewController/flowMapping/edgeGeometry/
VicinityEdge/snapshot/settings touched. Throwaway code is clearly marked with the ticket id and
Phase-1 deletion notes throughout.

## Must-address before/at close

1. **I1** — record findings on the ticket via `ticket add-note` (or explicitly waive the wording
   with the human, since the substance exists in `.ai_out`).
2. **I2** — make a deliberate call on `loadAvoid()`'s cached-rejection behavior (reset-on-fail vs
   documented-sticky) since Phase 1 inherits it.

Neither is a technical blocker to the spike's de-risk goal. Everything the ticket set out to
prove — offline WASM load in real Obsidian, obstacle avoidance, nested-shape routing, and a
crash-free 100× create/destroy cycle — is proven and independently reproduced.
