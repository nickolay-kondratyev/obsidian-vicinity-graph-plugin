---
session_ids: [{"a": "claude", "type": "execution", "id": "b449310a-2a4f-4579-a8e2-dfe484ced109"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_fqdc55oifopcxxs4eb0w8q876_e
title: "Named relationships: named-depth settings rows"
status: in_progress
deps: [nid_ufbtmywzbsyn2gwrx7bi0ww08_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-17T18:53:38Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Product defaults (human sign-off 2026-08-17): named-outgoing 2, named-incoming 1; pinned-root variants follow the existing pinned-default convention. Declare them ONLY in src/engine/settingsProductDefaults.test.ts per the one-file rule.

Surface the two new depth budgets (`named-outgoing`, `named-incoming`) + their pinned-root variants as settings rows through the ONE declared machinery — read CLAUDE.md "Settings rows/values/tests" sections FIRST. Touch: SETTINGS_SPEC leaves (full BoundedNumberSpec), src/view/settingsRows.ts declaration, src/view/settingsRowAccessors.ts accessor, literal defaults/ranges ONLY in src/engine/settingsProductDefaults.test.ts, both presenters via their compile-error-closing switches. The spec-walking tripwire suites and settingsRowSpecCoverage will FAIL until rows are properly declared — let them drive.

e2e: settings tab has NO npm-test coverage — run `npm run test:e2e` for the settings surface (settle writes via e2e/settingsWriteWindow.ts, never sleep).

