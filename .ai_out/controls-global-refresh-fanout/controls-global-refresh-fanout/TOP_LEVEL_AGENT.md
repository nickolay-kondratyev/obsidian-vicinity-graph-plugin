# TOP_LEVEL_AGENT — controls-global-refresh-fanout

Ticket: `nid_u36pqr4zljs44jt42lk9ln8ry_e` — a controls-panel settings write does not refresh OTHER open graph views. **CLOSED**.

Branch: `controls-global-refresh-fanout` (from `main` @ a14972a).

## Flow record
1. **EXPLORATION** (Explore) → `EXPLORATION_PUBLIC.md`. Agent had no write tools; TOP_LEVEL_AGENT persisted its findings. Commit `0e22a12`.
2. **IMPLEMENTATION_WITH_SELF_PLAN** → `caa4e34`. `ViewsRefreshPort` seam + pure scope classifier + first-ever `ControlsActions.test.ts`.
3. **IMPLEMENTATION_REVIEW** → `IMPLEMENTATION_REVIEW__PUBLIC.md`. **READY, 0 blocking, 3 SHOULD-FIX**. Reviewer re-ran gates itself and verified the exhaustiveness guard (added a 6th command kind to a copy → TS2366) and the fan-out coverage claim.
4. **IMPLEMENTATION_ITERATION r1** → `e777ed4`. All 3 should-fix ACCEPTED; follow-up ticket filed.
5. **IMPLEMENTATION_REVIEW r2** (scoped delta review) → `IMPLEMENTATION_REVIEW_ROUND2__PUBLIC.md`. **READY, 0 blocking**. Verified the `WriteOutcome` behaviour change cannot swallow a needed UI snap-back (no `useState`/`useRef` in any control component; `withPersistableIdentity` classifies before persisting).
6. **DOC_FIXER** → `0a22e10`. Last stale doc-comment in `viewPorts.ts`.

Converged in 1 iteration. Both roles signalled readiness.

## Outcome
- Global command kinds AND pin/unpin fan out to every open vicinity-graph view; per-doc depth writes stay on the owning view.
- `npm test` 938/938, `npm run check` clean (run independently by reviewer and doc-fixer). No e2e (real-Obsidian release gate).
- change_log entry `8kuw912hrfyqnswqjmywkr3iy`.

## Deliberate scope decisions (human attention)
- **pin/unpin now fan out too** — wider than the ticket text, judged correct because the pinned set is global `data.json` state every view renders.
- **Per-doc narrowness is a scope boundary, not an invariant.** Sibling views follow the active file and share MAIN, so they DO go stale on a depth write. Kept out of scope per the acceptance criteria; filed as `docs-internal/tickets/ticket-per-doc-write-leaves-sibling-views-stale.md`.
