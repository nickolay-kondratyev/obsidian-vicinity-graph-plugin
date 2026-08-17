---
closed_iso: 2026-08-17T18:57:02Z
session_ids: [{"a": "claude", "type": "execution", "id": "b449310a-2a4f-4579-a8e2-dfe484ced109"}, {"a": "claude", "type": "review", "id": "a80b9fd9-af7b-4a79-8a05-66452633ce11"}, {"a": "claude", "type": "test-fix", "id": "a0d45304-1fcb-4244-8f26-8610dadd94f2"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_fqdc55oifopcxxs4eb0w8q876_e
title: "Named relationships: named-depth settings rows"
status: closed
deps: [nid_ufbtmywzbsyn2gwrx7bi0ww08_e]
links: []
created_iso: 2026-08-17T16:44:24Z
status_updated_iso: 2026-08-17T18:57:02Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [named-relationships]
---

Part of the named-relationships set. Read the PLAN first: `_tickets/add-ability-for-named-relationships.md` (closed plan ticket nid_fg66tanwkoyq3cqs1wdxagn21_e) — full syntax spec, signed-off decisions, architecture. Repo conventions: `CLAUDE.md` (layering view→adapters→engine, BDD tests, settings machinery).

Product defaults (human sign-off 2026-08-17): named-outgoing 2, named-incoming 1; pinned-root variants follow the existing pinned-default convention. Declare them ONLY in src/engine/settingsProductDefaults.test.ts per the one-file rule.

Surface the two new depth budgets (`named-outgoing`, `named-incoming`) + their pinned-root variants as settings rows through the ONE declared machinery — read CLAUDE.md "Settings rows/values/tests" sections FIRST. Touch: SETTINGS_SPEC leaves (full BoundedNumberSpec), src/view/settingsRows.ts declaration, src/view/settingsRowAccessors.ts accessor, literal defaults/ranges ONLY in src/engine/settingsProductDefaults.test.ts, both presenters via their compile-error-closing switches. The spec-walking tripwire suites and settingsRowSpecCoverage will FAIL until rows are properly declared — let them drive.

e2e: settings tab has NO npm-test coverage — run `npm run test:e2e` for the settings surface (settle writes via e2e/settingsWriteWindow.ts, never sleep).

## Resolution (2026-08-17)

The engine dependency (`nid_ufbtmywzbsyn2gwrx7bi0ww08_e`) had ALREADY landed
every non-row piece: the four spec leaves (`namedDepthOut` 2, `namedDepthIn` 1,
`pinnedNamedDepthOut` 2, `pinnedNamedDepthIn` 1) as full `BoundedNumberSpec`s in
`src/engine/SettingsSpec.ts`, and their literal defaults in
`src/engine/settingsProductDefaults.test.ts`. So this ticket was purely the
row-surfacing step.

What was built — two files touched, no new machinery:

- **`src/view/settingsRows.ts`** — added four rows to the existing `depth`
  control kind (which is generic over `keyof DepthSettings`, so no accessor,
  presenter, or write-plan change was needed):
  - active "From the active note" block: **Named links out** (`namedDepthOut`)
    and **Named links in** (`namedDepthIn`), placed after "Links in", before
    "Descendants".
  - pinned "From each pinned note" block: **Pinned named links out**
    (`pinnedNamedDepthOut`) and **Pinned named links in** (`pinnedNamedDepthIn`),
    in the matching position. Descriptions note the either-budget union (named
    links also ride the plain channels) and `0 = off`.
- **`src/view/settingsRowSpecCoverage.test.ts`** — emptied the `REACHABLE_LATER`
  allowlist (the four entries that deferred these exact rows); its anti-rot test
  now REQUIRES they be gone since the rows exist.

Why nothing else changed: the `depth` accessor (`SettingsRowAccessors.depth`),
both presenters' `case "depth"` arms, the spec-coverage leaf-id mapping, and the
e2e `settingsBaseline.ts` are all data-driven over `keyof DepthSettings` /
`SETTINGS_GROUPS`, so declaring the rows was the whole job.

Verified: `npm run check` (0 errors), `npm test` (2296 pass), and
`npm run test:e2e -- settingsUxVisual.e2e.ts settingsDependentRows.e2e.ts`
(24 pass — the accessible-name and subheading checks render the new rows).


## Notes

**2026-08-17T18:59:00Z**

__READY_AS_IS__: purely-declarative four depth rows over data-driven machinery; check + npm test (2296) + settings e2e (24) all green, no defects found.
