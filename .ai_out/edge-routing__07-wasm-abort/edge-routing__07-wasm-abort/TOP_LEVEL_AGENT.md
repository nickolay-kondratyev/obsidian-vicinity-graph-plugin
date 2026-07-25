# TOP_LEVEL_AGENT — edge-routing__07-wasm-abort

**Ticket**: `_tickets/edge-routing-a-throw-inside-route-kills-the-wasm-module-for-the-rest-of-the-session.md`
(`nid_oy3vas85xhr34n2dby1mvows4_e`)

**Flow**: root-cause-and-fix
`EXPLORE → [CLARIFICATION?] → REPRODUCE → FIND_ROOT_CAUSE → ROOT_CAUSE_REVIEW → IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION`

**Branch**: `edge-routing__07-wasm-abort` (off `main` @ b41b7b7)
**Out dir**: `.ai_out/edge-routing__07-wasm-abort/edge-routing__07-wasm-abort/`

## Phase log

| Phase | Status | Result file |
|-------|--------|-------------|
| EXPLORE | done | `EXPLORATION_PUBLIC.md` |
| CLARIFICATION | skipped — no blocking ambiguity | — |
| REPRODUCE | done — RED test at `src/view/edgeRouting.test.ts:675` | `REPRODUCE__PUBLIC.md` |
| FIND_ROOT_CAUSE | done | `FIND_ROOT_CAUSE__PUBLIC.md` |
| ROOT_CAUSE_REVIEW | done — APPROVED-WITH-CONDITIONS (12 conditions) | `ROOT_CAUSE_REVIEW__PUBLIC.md` |
| IMPLEMENTATION_WITH_SELF_PLAN | done — all 12 conditions met | `IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md` |
| IMPLEMENTATION_REVIEW | done — 0 BLOCKING, 2 SHOULD-FIX, 2 NIT | `IMPLEMENTATION_REVIEW__PUBLIC.md` |
| IMPLEMENTATION_ITERATION | done — CONVERGED, both roles READY (1 cycle of 4) | `IMPLEMENTATION_ITERATION__PUBLIC.md` |

## Outcome

Fix: unconditional `router.processTransaction()` as the first statement of `AvoidArena.dispose()`
(`src/view/edgeRouting.ts`) — a teardown invariant of `AvoidArena`. Closes the whole class of
"any throw between first shape registration and `processTransaction()`", not just the one throw site.

Gates: `npm run check` exit 0; `npm test` 67 files / 866 tests passed; 0 wasm aborts.

## Close-out
- Ticket `nid_oy3vas85xhr34n2dby1mvows4_e` — closed with resolution note.
- Ticket `nid_a7uwpxayt6w5vdnw8ogwskwvh_e` (non-finite coords) — priority 2 → 1, note added.
- Ticket `nid_eim1ftv60ybxzcucgf7rf4gk8_e` — filed: warn-once latch swallows later distinct failures.
- Change log entry `w4yv1tdih1qnpuhickcqo74uy`.

## Notes
- Human asked to "dive deeper as well if there are other ways to solve" — options were NOT limited to
  the ticket's two candidates; the loader-de-memoisation idea was disproved (libavoid-js `AvoidLib.load()`
  is a load-once singleton) and the input-validation angle (option c) reframed the throw as unreachable.
