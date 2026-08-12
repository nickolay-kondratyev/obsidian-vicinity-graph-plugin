---
id: nid_dthnhlzp0wzxqhcozj3f8ih5h_e
title: "Settings: id-ref frontmatter field list (text row, default empty)"
status: open
deps: [nid_sjojyvd55emyry45qynphei7o_e]
links: []
created_iso: 2026-08-12T17:19:34Z
status_updated_iso: 2026-08-12T17:19:34Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

Part 1 of the frontmatter-id links feature. Read the plan first: ticket nid_sjojyvd55emyry45qynphei7o_e (_tickets/plan-frontmatter-id-links-depslinks-fields-referencing-note-ids.md).

Add ONE new settings spec leaf (working name `idRefFields`): a string-valued, comma-separated list of frontmatter field names whose values are treated as references to other notes' frontmatter `id`. DEFAULT EMPTY = feature off. Locked human decisions: default empty; user adds each field name individually; the row carries info text explaining the feature ("Fields listed here are read as references to other notes' frontmatter id, and rendered as ordinary link edges in the graph. Example: deps, links").

Scope:
- Spec leaf in src/engine/SettingsSpec.ts + settings type. This is the first NON-NUMBER leaf, so a new declared row control kind (`text`) is likely needed: src/view/settingsRows.ts (SETTINGS_GROUPS), the switch in BOTH presenters (settings tab + in-graph panel; closed by unhandledRowControl — declare the row, follow the compile errors), value accessor in src/view/settingsRowAccessors.ts (read/interaction; no bounds/clamp for text — adjust the accessor type accordingly rather than faking bounds).
- Follow ALL settings conventions in CLAUDE.md: ONE write pipeline via SettingsInteraction naming this one field; typed field commits on COMMIT (blur / tab debounce), NEVER per keystroke; no hand-typed labels in presenters.
- Parsing helper (trim, split on commas, drop empties, dedup) lives with the spec/shared layer so the adapter ticket consumes ONE canonical parse — do not let tab, panel and adapter each split the string.
- Tests: the SETTINGS_SPEC-walking suites (round-trip, reset-to-default, spec coverage src/view/settingsRowSpecCoverage.test.ts, parity src/view/settingsRowParity.test.ts) must pass with the leaf wired; declared default lands ONLY in src/engine/settingsProductDefaults.test.ts. Add BDD tests for the parse helper. Rendered panel-side component test for the text row (jsdom pragma pattern, src/view/testFixtures/settingsPanelHarness.tsx). e2e: settings tab row renders and a typed value persists (settle via e2e/settingsWriteWindow.ts, never sleep) — required because the tab has no npm-test coverage.

Out of scope: the graph does NOT yet consume the value — that is the dependent adapter ticket.

