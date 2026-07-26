# TOP_LEVEL_AGENT — sparse-eval-edge-flake

Ticket: `nid_li45606h8uvcnjm7fss17xl1u_e` — "e2e: sparse eval fixture flips between 10 and 11 edges run-to-run"
Branch: `sparse-eval-edge-flake` (off `main` @ f92a229)

## Flow
straightforward-flow: EXPLORE → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION

## Log
- [x] Branch created, ticket set in_progress.
- [ ] EXPLORE (2 agents, parallel): harness side + plugin side.
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] change_log entry (TOP_LEVEL only), ticket close, merge to main.

## Hard constraints from the ticket
- Root cause must be STATED: plugin-side race vs harness-side observation race.
- No fixed-timeout increase as the fix. Deterministic condition wait required.
- If plugin-side: file a separate bug ticket, do not bury it.
- Acceptance: 5 consecutive `npm run test:e2e -- edgeRoutingEval.e2e.ts` runs with identical sparse `edges=`.
