# DOC_FIXER PRIVATE — edge-routing__04

## Decisions / reasoning trail

- **Status vocabulary**: `_tickets/` uses `open|closed|resolved`. The whole
  edge-routing__00–03 family uses `closed`; chose `closed` over the task's `done`
  fallback for consistency (task allowed matching the repo vocab).
- **status_updated_iso**: created_iso already equalled the requested
  2026-07-23T18:09:12Z; bumped to 2026-07-23T20:45:00Z so the update timestamp is
  strictly later than creation (a same-value bump would be meaningless).
- **CHANGELOG format**: matched the file's `## YYYY-MM-DD — headline` + prose root-cause
  paragraph + bullets + `Verified:` tail. Kept the ticket nid reference like siblings.
- **high-level-plan skip**: confirmed by reading it end-to-end — it is the pre-epic design
  doc; edge routing (libavoid) was added later via the edge-routing epic tickets and is
  NOT a documented behaviour there. The line-92 edge section is about arrowheads/pairing,
  a different concern. Nothing stale to fix.
- **architecture-map skip**: line 49 describes libavoid at the "orthogonal edge routing
  (WASM)" altitude — still accurate. Endpoint-pin strategy / `RoutingObstacle.kind` are
  below that altitude; no invariant the map asserts changed.
- **README skip**: `rg -ni "rout|boundary pin|detour"` → 0 hits; routing is not part of
  the user-facing settings model documented there.

## Verification of claims (against task summary + git)

- git log confirms 3 impl commits (61c5db7 feat, 5e175ed test, c060122 fix) on branch.
- diff --stat: edgeRouting.ts (+161/-…), edgeGeometry.ts (+42), libavoidLoader.ts (+8),
  GraphViewController.ts, plus test files — consistent with Phase A+B, no engine touch.
- Did NOT re-run tests (docs-only role); relied on VERIFICATION__PUBLIC + task summary
  for 664/664 and perf numbers.

## Not done (out of scope / per instructions)

- No git commit. No `change_log` run (TOP_LEVEL owns it). No src/test edits.
