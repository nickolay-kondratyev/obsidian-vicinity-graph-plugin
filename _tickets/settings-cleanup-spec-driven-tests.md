---
id: nid_x6hgehsu5il1d1shuraz3ufqy_e
title: "Settings cleanup — spec-driven tests: re-pin settings tests on the spec instead of hand-enumerated literals"
status: open
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e, nid_m5hxe4eo9jgt7cfic7s2o3uvi_e, nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_ek3wrqoh1rsftk6ulg836mghf_e]
created_iso: 2026-07-29T17:30:12Z
status_updated_iso: 2026-07-29T17:30:12Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, testing]
---

Overarching context, ordering rationale and standing owner decisions: docs-internal/notes/settings.md (grouping tag: settings-cleanup, step 5 of the chain).

Part of the settings cleanup approved by the owner on 2026-07-29. Depends on the descriptor model, the write pipeline, and the dual presenters (see deps) — the tests pin against their final shape.

PROBLEM: settings tests hand-enumerate expected values (toEqual literals over every field), so they go stale whenever a default moves and they do NOT catch a field that was never wired. Two real instances of exactly this staleness already happened -- see docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md and ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md (both now resolved, spec and test agree at linkStrengthFactor max 4; verified 2026-07-29 with npm test GREEN, 1153 passed).

GOAL:
1. Spec-ITERATING tests: walk SETTINGS_SPEC / the descriptor list and assert structural properties (every field parses, round-trips, resets to its declared default, has bounds honoured) rather than restating literals.
2. A tab-vs-panel PARITY test over the descriptor list (this is the dual-presenters ticket's structural guard).
3. nid_ek3wrqoh1rsftk6ulg836mghf_e -- no e2e currently TYPES into a settings-tab text/number input. Add one that types an inverted max and a bad regex, establishing the debounce-window pattern. Re-scope it to assert the unified renderer, so schedule it AFTER the dual-presenters ticket.

Keep a SMALL number of literal assertions for genuinely product-meaningful defaults (e.g. nodeCap default 100) -- structural tests must not erase the ability to notice an unintended default change.

