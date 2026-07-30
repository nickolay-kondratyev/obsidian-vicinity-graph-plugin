# TOP_LEVEL_AGENT — "Show cross links" setting

Ticket: `nid_puf4a4q6fgn5lpehh5dowfm1r_e`
File: `_tickets/spec-an-all-edges-view-mode-as-a-real-feature-ui-persistence.md`
Feature dir: `.ai_out/show-cross-links/nid_puf4a4q6fgn5lpehh5dowfm1r_e_2026-07-30T02-37-25PDT/`

## Flow (straightforward)
1. IMPLEMENTATION_WITH_SELF_PLAN
2. IMPLEMENTATION_REVIEW
3. IMPLEMENTATION_ITERATION (max 4)

## Known spec caveat flagged to implementer
Ticket says "full cascade: global / MAIN / pinned override". CLAUDE.md now states settings are
**global-only** (`Nothing is per-document`) — the cascade was removed by the settings-global-only
work. Implementer must ship it as a plain global boolean row on the declared-row model and note
the deviation.

## Log
- [start] spawned IMPLEMENTATION_WITH_SELF_PLAN
- [phase 1] IMPLEMENTATION_WITH_SELF_PLAN done → commit c388a7c
- [phase 2] IMPLEMENTATION_REVIEW → APPROVE WITH CHANGES (0 blocking, 2 should-fix, 3 nice-to-have)
- [phase 3] IMPLEMENTATION_ITERATION → 4 accepted, 1 partial/rejected → commit 647fb8e
- [verify] top-level re-ran gates itself: npm test 1308 pass, npm run check exit 0
- [close] ticket closed + resolution note; change_log tvm2de2f8dub8skoq8wfs37n4
- No follow-up ticket: nothing left outstanding.
