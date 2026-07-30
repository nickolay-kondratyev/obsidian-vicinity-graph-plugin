---
closed_iso: 2026-07-30T03:38:15Z
id: nid_x6hgehsu5il1d1shuraz3ufqy_e
title: "Settings cleanup — spec-driven tests: re-pin settings tests on the spec instead of hand-enumerated literals"
status: closed
deps: [nid_wimjq4ewgbg21n4zx9d4qq3a0_e, nid_m5hxe4eo9jgt7cfic7s2o3uvi_e, nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_ek3wrqoh1rsftk6ulg836mghf_e, nid_5meu9s38sbrv1703na77of4m7_e, nid_5rdya0nr660n9sru1zhfs51ic_e]
created_iso: 2026-07-29T17:30:12Z
status_updated_iso: 2026-07-30T03:38:15Z
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


## Notes

**2026-07-29T22:11:13Z**

SCOPE CHANGE (owner, 2026-07-29): per-doc saved state is removed by nid_ez38gf1mrdgh5kxedzrdicwzl_e before this ticket. Spec-iterating tests cover GLOBAL round-trip/reset/bounds only — do NOT write per-doc override round-trip tests (CentralDepthRoundTrip.test.ts is deleted by the simplification ticket). Parity test scope unchanged.

**2026-07-30T03:38:15Z**

RESOLVED 2026-07-30. Commits 3468387 (implementation) + 9dee711 (review iteration) + b25965d (docs). Change log 2ldhlprhblfpgvg1lhviq4awp. Tests 87 files/1139 -> 91 files/1160, all green; npm run check clean.

GOAL 1 DONE — spec-ITERATING suites. src/engine/SettingsSpec.test.ts and src/engine/forceLayoutSettings.test.ts no longer restate values: one walk over SETTINGS_SPEC drives parse, global round-trip, reset-to-declared-default and bounds (below-min / above-max / garbage -> declared default), with min/max read FROM the descriptor. A spec field declared but never wired now FAILS 9 tests across 4 files, each naming the field — proven by mutation and independently reproduced by the reviewer, not assumed.

GOAL 2 DONE — src/view/settingsRowParity.test.ts already existed from step 4, so it was strengthened rather than rebuilt: comment-stripped, module-keyed scans plus a genuine per-row label check. A per-row skip in EITHER presenter, a walker skip, or a commented-out control-kind case each redden it by name. Residual render-level parity needs a jsdom harness and is recorded on nid_7qot0m6nuxxmd5z0yb9jylsd6_e.

GOAL 3 NOT DONE HERE, BY DESIGN — the typed-input e2e is its own ticket nid_ek3wrqoh1rsftk6ulg836mghf_e, which deps on THIS ticket and is therefore scheduled after it. Now unblocked and re-scoped in a note to assert the unified renderer.

LITERAL DEFAULTS — src/engine/settingsProductDefaults.test.ts is now the ONLY file where a default or range literal may be written. It pins all 21 spec leaves id-keyed, which is MORE than the "SMALL" set this ticket asked for: a curated subset was tried first and provably left centerPullStrength 0.05, linkStrengthFactor max 4 and edgeRoutingClearancePx 11 with zero tripwire while claiming coverage. Reviewer measured that a default change now fails exactly ONE file / ONE test (vs three mirrors before) and judged it acceptable, but it is a deviation from an explicit owner instruction — filed for ratification or trim as nid_5rdya0nr660n9sru1zhfs51ic_e (decide).

ONE PRODUCTION LINE CHANGED, called out: clampOutlineMaxDepth now resolves NaN to the spec default via the existing clampIntoRange — a genuine inconsistency the new bounds test surfaced. Finite-input behavior unchanged, covered by test.

Also filed in passing: nid_5meu9s38sbrv1703na77of4m7_e (decide) on pinned nodeCap load behavior, rather than silently changing it.
