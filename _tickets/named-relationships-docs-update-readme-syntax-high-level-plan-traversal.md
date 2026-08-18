---
closed_iso: 2026-08-18T02:44:53Z
session_ids: [{"a": "claude", "type": "execution", "id": "69173b8a-3690-4d64-af54-d708cac4193b"}, {"a": "claude", "type": "review", "id": "7b755f27-cc06-41de-bc6b-9b3d7b2d2474"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_onhd5y7uqnbz8fl1hweryjuk4_e
title: "Named relationships: docs update (README syntax + high-level-plan traversal)"
status: closed
deps: [nid_wnagjm2j144u0jsgixpcmmpar_e, nid_ibx7hmt6cvmjh5rydi2aiyab9_e, nid_fqdc55oifopcxxs4eb0w8q876_e]
links: []
created_iso: 2026-08-17T17:12:26Z
status_updated_iso: 2026-08-18T02:44:53Z
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

## Resolution (2026-08-17)

Docs-only change; both docs describe SHIPPED behavior, verified against source
(not the plan ticket, which lacked pinned defaults).

**`README.md`** — new user-facing `## Named relationships` section (placed after
`## Folder-note hierarchy`, before `## Settings`) covering: what a named
relationship is with a worked example, the three statement forms (bare,
bracketed + qualifier, relationship-note) with examples, comma lists + named
embeds, the `name [X] qualifier` edge label with the `[X]` target marker,
frontmatter link-valued properties as named relationships (key = name, always
on, distinct from the `idRefFields` *Frontmatter links* setting), what renders on
the connector (all names + `+N` chip) vs the click-through preview (names,
qualifiers, context, rel-note links), the separate depth reach, and the
code-region / inline-frontmatter exclusion. Also updated the Settings → **Depth**
bullet to list *Named links out* / *Named links in* and their **2 / 1** defaults.

**`docs-internal/plan/high-level-plan.md`** — added `named-outgoing` /
`named-incoming` rows to the channel table (budgets `namedDepthOut` /
`namedDepthIn`, UI labels *Named links out* / *Named links in*) and a new
`### Named relationships` subsection under the traversal docs recording: the two
new channels + pinned variants with defaults **MAIN 2/1, pinned 2/1** (pinned
follows the link convention, confirmed in `settingsProductDefaults.test.ts`), the
either-budget union (named refs merged into the SAME outgoing/incoming/count
streams via `OutgoingReferences.deduped` in the adapter, so the engine sees
ordinary references carrying `relations` names — no new edge source), the eager
incremental `NamedRelationshipsIndex` discovery, and edge assembly / rel-note
per-occurrence folding + the `RELATION_TARGET_MARKER` `[X]` label.

Shipped-behavior details worth knowing for the next reader: UI labels are "Named
links out/in" (not "named-outgoing"); flyout section heading is "Relationships"
(`NAMED_RELATION_SECTION_TITLE`); frontmatter named relations are always-on and
have NO setting of their own. No code/tests touched; markdown only, so no build
or e2e gate applies.


## Notes

**2026-08-18T02:47:00Z**

__READY_AS_IS__: docs-only branch; README + high-level-plan claims (named-rel syntax, [X] marker, depth defaults 2/1 MAIN & pinned, channel table, code/frontmatter masking) all verified against implementation.
