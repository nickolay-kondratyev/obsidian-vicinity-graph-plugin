---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_onhd5y7uqnbz8fl1hweryjuk4_e
title: "Named relationships: docs update (README syntax + high-level-plan traversal)"
status: in_progress
deps: [nid_wnagjm2j144u0jsgixpcmmpar_e, nid_ibx7hmt6cvmjh5rydi2aiyab9_e, nid_fqdc55oifopcxxs4eb0w8q876_e]
links: []
created_iso: 2026-08-17T17:12:26Z
status_updated_iso: 2026-08-18T02:41:35Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships, docs]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture.

Created at ticket review 2026-08-17: the set ships a whole user-facing SYNTAX but no ticket updated the docs (every prior feature set had a docs leg, e.g. `_tickets/hierarchy-5-e2e-coverage-docs-update-for-folder-hierarchy.md`).

- `README.md`: user-facing named-relationships section — the three statement forms with examples (bare, bracketed + qualifier, rel-note), frontmatter fields, the two named depth settings, what renders on the edge vs in the flyout, and the code-region/frontmatter exclusion. Use the plan ticket as the source; keep it customer-focused.
- `docs-internal/plan/high-level-plan.md` is the design source of truth for TRAVERSAL (per repo CLAUDE.md) — record the two new channels (`named-outgoing`/`named-incoming` + pinned variants), the either-budget union, and rel-note folding there.

Do this LAST (deps: view, frontmatter, settings tickets) so the docs describe shipped behavior, not the plan.

