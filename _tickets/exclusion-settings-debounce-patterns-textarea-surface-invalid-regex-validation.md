---
id: nid_9uu8wncncsj8l59bq17y4gujy_e
title: "Exclusion settings: debounce patterns textarea + surface invalid-regex validation"
status: open
deps: []
links: []
created_iso: 2026-07-23T22:25:40Z
status_updated_iso: 2026-07-23T22:25:40Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [exclusion, view, ux]
---

Follow-up from the global-node-exclusion feature (branch global-node-exclusion).

Two deferred NITs from IMPLEMENTATION_REVIEW:
1. The exclusion patterns textarea in src/view/VicinityGraphSettingTab.ts persists + triggers a full graph rebuild on every keystroke (consistent with existing node-cap/sizing precedent). Consider debouncing if it proves janky in practice.
2. Invalid regex patterns are currently silently skipped (per product decision). Consider surfacing per-line validation feedback in the settings tab so users know a pattern was ignored.

Matcher lives in src/engine/PathExclusionMatcher.ts. Semantics documented in README.md "Node exclusion" section.

## Acceptance Criteria

Textarea does not rebuild on every keystroke (debounced or on-blur); invalid patterns are visibly flagged to the user.

