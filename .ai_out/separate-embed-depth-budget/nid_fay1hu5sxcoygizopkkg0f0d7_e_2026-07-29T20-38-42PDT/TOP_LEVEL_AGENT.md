# TOP_LEVEL_AGENT — separate depth budget for embedded outgoing links

Ticket: `nid_fay1hu5sxcoygizopkkg0f0d7_e` (settings-cleanup step 6, the final step).
Branch: `nid_fay1hu5sxcoygizopkkg0f0d7_e_2026-07-29T20-38-42PDT`.

## Preconditions verified
All four `deps` tickets are **closed** — Stage 0 (compile-time completeness guards),
descriptor model, dual presenters, spec-driven tests, and the per-doc-state removal.
So the declarative settings model is in place and this ticket is the MEASUREMENT of it.

## Scope decided by TOP_LEVEL_AGENT (from settled owner decisions in the ticket)
IN scope:
- **Stage 1** — carry `LinkKind = "link" | "embed"` on OUTGOING refs; markdown array
  provenance, `!` capture in the two shared regexes, canvas `file-node` ⇒ embed,
  adopt **3a always-parse canvases**. No behavior change.
- **Stage 3** — `Direction` → 3-value CHANNEL enum (`outgoing-link | outgoing-embed |
  incoming`), 6a kind-pure BFS; rename global keys `outgoingDepth`→`linkDepthOut`,
  `incomingDepth`→`linkDepthIn`, add `embedDepthOut` (default equal to `linkDepthOut`
  ⇒ zero observable change at defaults). No migration (clean break, unpublished).
- Release-note line in `docs-internal/RELEASE_CHECKLIST.md` (D2 mitigation).
- Spec/docs updates: `docs-internal/plan/high-level-plan.md`, `README.md`.
- Test pinning D5 invariant: attachments stay decided by node-bearing-ness, not kind.
- **MEASUREMENT MANDATE** write-up: actual files/lines cost of the new field vs the
  ~15-files / ~8-hand-maintained-lists baseline, honestly.

OUT of scope (follow-up ticket): **Stage 2** visual embed distinction (D3: explicitly
"AFTER Stage 3"). D5 attachment redefinition is REJECTED outright — no ticket.

## Flow
1. EXPLORATION (Explore, sonnet) → `EXPLORATION_PUBLIC.md`
2. Stage 1: IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEWER → iteration → commit
3. Stage 3: IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEWER → iteration → commit
4. Docs + measurement write-up + change_log + follow-up ticket + close this ticket

## Log
- [start] verified deps closed, tree clean, spawned EXPLORATION.
