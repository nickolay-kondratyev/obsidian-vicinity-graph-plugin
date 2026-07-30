---
id: nid_t25rc8sd9nmlbmrn69k4zsaes_e
title: "ControlsActions: route its pin Notice through UserNoticePort"
status: open
deps: []
links: [nid_itpt4tf0kkhsbbz0np304a558_e]
created_iso: 2026-07-30T05:54:07Z
status_updated_iso: 2026-07-30T05:54:07Z
type: chore
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, view, consistency]
---

Follow-up from ticket nid_itpt4tf0kkhsbbz0np304a558_e, which introduced `UserNoticePort` (declared in `src/view/viewPorts.ts`, implemented in `src/main.ts`, faked by `src/view/FakeUserNotices.ts`) as THE user-visible message surface for the view layer.

GAP: `src/view/ControlsActions.ts` still constructs `new Notice(...)` directly for its "This note can't be pinned (no stable id)." message — so there are now two ways to show a notice. Its test (`src/view/ControlsActions.test.ts`) needs `vi.mock("obsidian", () => ({ Notice: class {} }))` only because of that direct import.

WORK: take a `UserNoticePort` in the `ControlsActions` constructor (threaded from `src/main.ts` through `src/view/VicinityGraphView.tsx`, which already receives `ViewsRefreshPort` the same way), drop the `obsidian` import and the `vi.mock` in the test, and assert the pin-refusal message through `FakeUserNotices` instead of not asserting it at all.

Behavior-neutral; kept out of the failure-policy ticket to keep that change focused.

## Acceptance Criteria

No view file except main.ts constructs Notice; ControlsActions.test.ts no longer mocks obsidian and asserts the refusal message via FakeUserNotices; npm test and npm run check pass.

