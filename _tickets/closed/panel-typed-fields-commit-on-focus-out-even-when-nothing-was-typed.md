---
closed_iso: 2026-07-31T17:49:58Z
id: nid_bbe962ojwwkhzn3uq27zw5w6l_e
title: Panel typed fields commit on focus-out even when nothing was typed
status: closed
deps: []
links: []
created_iso: '2026-07-30T09:03:50Z'
status_updated_iso: 2026-07-31T17:49:58Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [ui, settings, panel]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Every typed number field in the controls panel (`src/view/SettingsRowView.tsx`, hook `useNumberFieldCommit`) commits ON BLUR. Focusing a field and leaving it WITHOUT editing therefore performs a full settings write for a value identical to the stored one — a persist plus a traversal/layout rebuild for no change.

Harmless today (the write is idempotent and `clampSizingSettings` is the backstop), and pre-existing: it was true of `NumberRow` before the per-metric weight joined the same protocol (see `.ai_out/panel-weight-uncontrolled/`). Raised by the implementation review of commit 1875811 as worth tracking rather than fixing inline.

Likely fix: have `NumberRowCommitPolicy.commit()` (in `src/view/numberRowCommit.ts`) be handed the value the field was SEEDED with, and return `NumberRowCommit.nothing()` when the committed text parses to that same number — one seam, unit-testable, no component change. Beware: `nothing()` still reseeds from the store, which is correct here.

## Acceptance Criteria

- Focusing and leaving a panel number field unchanged performs NO settings write (pinned at the `NumberRowCommitPolicy` seam in `src/view/numberRowCommit.test.ts`).
- Editing then restoring the original text by hand is also a no-op write.
- All existing blur-commit behaviour (refusals, blank/mid-edit text, reseeding) unchanged.

## Resolution (2026-07-31)

Implemented exactly as the "likely fix" proposed, on branch `CC_nid_bbe962ojwwkhzn3uq27zw5w6l_e__panel-typed-fields-commit-on-focus-out-even-when-n_fable`.

- `NumberRowCommitPolicy.commit(raw)` became `commit(raw, seededWith)` (`src/view/numberRowCommit.ts`): after the accessor accepts the text, `parsed === seededWith` returns `NumberRowCommit.nothing()` — no write, no message, field reseeded (the reseed is what normalises a respelling like `077` back to `77`). The equality check runs BEFORE the cross-field judge, deliberately: an untouched field must not earn a refusal on focus-out.
- The one call site (`useNumberFieldCommit` in `src/view/SettingsRowView.tsx`) passes `stored` — the same number used as the input's `defaultValue`, so "seeded with" and "untouched commits" are provably the same value. No other component change.
- Tests: new `describe("NumberRowCommitPolicy: a commit that changed nothing")` in `src/view/numberRowCommit.test.ts` pins all three acceptance criteria (unchanged text, respelled text, still-reseeds, no-refusal-even-if-cross-field-rule-would-fire, and the node cap to show the rule is not sizing-specific). Existing suite calls updated to the two-arg seam via a shared `SEEDED_WITH` constant chosen to never collide with a committed value. Started from failing tests (4 red), then implemented.
- Verified: full `npm test` (1315 tests, 97 files) and `npm run check` pass.
