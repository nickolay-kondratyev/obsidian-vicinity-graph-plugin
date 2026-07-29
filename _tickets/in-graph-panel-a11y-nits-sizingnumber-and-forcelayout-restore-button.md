---
id: nid_que9qloigra7ku2boh83qizz0_e
title: "In-graph panel a11y nits: SizingNumber and ForceLayout restore button"
status: open
deps: [nid_armoson86j0ii8c33r1odo1rc_e]
links: [nid_1rslube8at5xj60ji4jeve0b0_e, nid_qp56jugz8en8wkgjirwcb269p_e, nid_armoson86j0ii8c33r1odo1rc_e, nid_klkdpmx6axf90y4xj8khwrlf2_e]
created_iso: 2026-07-25T17:14:21Z
status_updated_iso: 2026-07-25T17:14:21Z
type: chore
priority: 4
assignee: CC_WITH-nickolaykondratyev
tags: [a11y, view, settings]
---

Inventoried while fixing ticket nid_5wiribg2mn0mqcr7ni4ya0cfe_e (settings-tab labels); deliberately out of that ticket's scope.

1. `src/view/SizingSection.tsx:116-126` — the `SizingNumber` input sits inside a wrapping `<label>` with a sibling `<span>{label}`, so it has an implicit accessible name, but unlike its twin at `:53-67` it carries no explicit `aria-label`. Inconsistent with the repo convention (aria-label set from the same string rendered visibly).
2. `src/view/ForceLayoutSection.tsx:53-60` — the "Restore defaults" `<button>` has visible text + `title` but no `aria-label`, unlike its settings-tab twin (`src/view/VicinityGraphSettingTab.ts` `addSectionReset`), whose accessible name carries the reset SCOPE. In the panel there is only one such button, so this is cosmetic consistency, not a real ambiguity.

Both are consistency nits, not user-visible defects. Do NOT introduce any new `Restore`-prefixed aria-label in the settings tab: `e2e/settingsResetReview.e2e.ts:190-200` asserts an exact ordered list of those.

## Acceptance Criteria

- Both controls follow one stated convention, or the ticket is closed with an explicit "implicit label is sufficient here" rationale recorded.
- No visual change; `npm test` and the e2e settings specs stay green.

