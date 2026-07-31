---
closed_iso: 2026-07-31T17:24:42Z
id: nid_5rdya0nr660n9sru1zhfs51ic_e
title: "Settings cleanup — ratify the literal-defaults tripwire size: SMALL was asked for, all 21 spec leaves shipped"
status: closed
deps: []
links: [nid_x6hgehsu5il1d1shuraz3ufqy_e]
created_iso: 2026-07-30T03:35:36Z
status_updated_iso: 2026-07-31T17:24:42Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, testing]
---

Overarching context: docs-internal/notes/settings.md (grouping tag: settings-cleanup). Follow-up from step 5, nid_x6hgehsu5il1d1shuraz3ufqy_e (closed).

OWNER DECISION NEEDED — one question; everything else is done and green.

WHAT THE TICKET ASKED: "Keep a SMALL number of literal assertions for genuinely product-meaningful defaults (e.g. nodeCap default 100) -- structural tests must not erase the ability to notice an unintended default change."

WHAT SHIPPED: src/engine/settingsProductDefaults.test.ts pins ALL 21 SETTINGS_SPEC leaf defaults in ONE id-keyed `toEqual` table, plus 2 range pins. That is more than "SMALL" on a literal reading, so it is a DEVIATION from an explicit owner instruction and needs your yes or a trim.

WHY THE IMPLEMENTER WENT TOTAL:
- A curated subset was tried FIRST. The reviewer measured it and found three defaults with ZERO tripwire: centerPullStrength 0.05, linkStrengthFactor max 4 and edgeRoutingClearancePx 11 could each be changed with the full suite still GREEN -- while the file header claimed they were covered.
- linkStrengthFactor max 4 is the exact value that went stale TWICE before (docs-internal/tickets/ticket-settings-baseline-tests-stale-after-spacing-change.md and docs-internal/tickets/ticket-settings-spec-baseline-tests-stale-after-node-spacing-bump.md).
- Only a TOTAL table also detects a spec leaf being ADDED or REMOVED; a subset cannot.
- Every candidate admission rule for "which defaults are product-meaningful" either admitted everything or silently dropped a value that had already drifted.

WHY IT IS ARGUABLY NOT THE OLD STALENESS (reviewer MEASURED this in round 2):
- Mutating nodeCap 100->250, centerPullStrength 0.05->0.15 or linkStrengthFactor.max 4->8 each fails EXACTLY ONE file / ONE test -- src/engine/settingsProductDefaults.test.ts.
- Grep confirms no other default or range literal survives anywhere else in the tests.
- The old pain was THREE separate mirrors to hunt down. There is now one table, and editing it is the conscious act of changing shipped behavior.

YOUR CALL:
(a) RATIFY as-is -- one total golden-defaults table is the intended contract. Cheapest: say so and drop the `decide` tag.
(b) TRIM to a curated subset -- then NAME the subset. It MUST include linkStrengthFactor max 4 (drifted twice). Accept that added/removed spec leaves lose their tripwire.
(c) Something else.

IF (a): also confirm the CLAUDE.md convention bullet added in step 5 (settings literals live in exactly ONE file, never mirrored) is the rule you want going forward.

Evidence and the full mutation matrix live in .ai_out/settings-cleanup-spec-driven-tests/nid_x6hgehsu5il1d1shuraz3ufqy_e_2026-07-29T19-51-59PDT/ -- IMPLEMENTATION_REVIEW_ROUND2__PUBLIC.md (measured verdict) and IMPLEMENTATION_ITERATION__PUBLIC.md (all 17 mutations reddening).

## Acceptance Criteria

- Owner picks (a), (b) or (c) and the `decide` tag is removed.
- IF (b): src/engine/settingsProductDefaults.test.ts trimmed to the named subset, its header comment made honest about what is NO LONGER guarded, and each remaining pin re-proved to redden by mutation.
- IF (a): no code change; ratification recorded in docs-internal/notes/settings.md.
- npm test green either way.

## Resolution (2026-07-31)

**Owner picked (a): RATIFY the total table as-is.** The one total golden-defaults
table in `src/engine/settingsProductDefaults.test.ts` (all 21 spec-leaf defaults,
id-keyed, plus the two pinned ranges) is the intended contract. Rationale accepted:
the curated subset was tried first and measurably left three defaults with zero
tripwire (including the twice-stale `linkStrengthFactor` max 4), every admission
rule for "product-meaningful" rotted, and only a total table catches an added or
removed spec leaf — while the old staleness (three mirrored baselines) stays fixed
because every mutation reddens exactly one test in one file.

**Owner also confirmed the CLAUDE.md convention bullet**: settings default/range
literals live in exactly ONE file (`settingsProductDefaults.test.ts`), never
mirrored into another suite — this is the standing rule going forward.

No code change. Ratification recorded in `docs-internal/notes/settings.md`
("Owner decision — RATIFIED 2026-07-31" + the standing-decisions bullet).
`decide` tag removed; ticket closed.

