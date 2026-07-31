---
id: nid_bbe962ojwwkhzn3uq27zw5w6l_e
title: Panel typed fields commit on focus-out even when nothing was typed
status: in_progress
deps: []
links: []
created_iso: '2026-07-30T09:03:50Z'
status_updated_iso: '2026-07-31T17:46:54Z'
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
