---
closed_iso: 2026-07-30T06:22:42Z
id: nid_itpt4tf0kkhsbbz0np304a558_e
title: "Settings writes: user-visible failure policy for void-ed write promises"
status: closed
deps: []
links: [nid_m5hxe4eo9jgt7cfic7s2o3uvi_e, nid_biwdtykvazsk3ejcqqli8o9j7_e, nid_t25rc8sd9nmlbmrn69k4zsaes_e, nid_o5a1055jyynn9nohpb5rj2vqp_e]
created_iso: 2026-07-30T01:17:40Z
status_updated_iso: 2026-07-30T06:22:42Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [settings, settings-cleanup, ux, robustness]
---

Pre-existing gap, unchanged by the write-pipeline ticket (nid_m5hxe4eo9jgt7cfic7s2o3uvi_e) and explicitly out of its scope. Both the implementer and reviewer of that ticket flagged it.

PROBLEM: several settings write promises are fire-and-forget (`void`), so a failed persist is silent to the user — the UI keeps showing a value that was never stored:
- the debounce window drain in `src/view/settingsDebounce.ts`
- `void this.writes.apply(...)` in `src/view/VicinityGraphSettingTab.ts`
- `void actions.restoreDefaults(...)` in the in-graph controls path (`src/view/ControlsActions.ts`)

Note the optimistic-control model (`src/view/optimisticValue.ts`) now RELEASES the override when the store does not move, so a failed write visibly snaps back to the old value — the value is not lied about, but the user is given no reason.

GOAL: ONE failure policy for the whole pipeline (`src/view/settingsWritePipeline.ts` is the natural single place), e.g. an Obsidian `Notice` naming the setting that failed to save. Keep it in one place — do not sprinkle try/catch at call sites.

Acceptance: a rejecting persist produces exactly one user-visible notice, covered by a test through the pipeline seam (no new test-infra deps needed).


## Notes

**2026-07-30T06:22:42Z**

RESOLVED. One failure policy now lives in SettingsWritePipeline.write() — the single body every settings write already passed through (tab apply, in-graph restoreDefaults, the settingsDebounce drain). A rejected persist raises exactly one Notice naming the setting's DECLARED label, logs the cause, and still fans out the refresh; the void-ed call-site promises stay void and are now safe. No try/catch was added at any call site.

Notice surface is behind UserNoticePort (src/view/viewPorts.ts), implemented over Notice in src/main.ts only, faked by src/view/FakeUserNotices.ts — same shape as ViewsRefreshPort/FakeViewsRefresh. Copy lives in src/view/settingsWriteFailureNotice.ts, subject taken from settingsRows.ts labels / SETTINGS_RESET_SCOPES, nothing hand-typed. A new walk over every declared row pins that the notice names the declared label, so a control kind can never leak into user copy.

Honest caveat, documented in code and docs-internal/architecture-map.md: PluginDataStore.persist() assigns in-memory state BEFORE saveData, so after a failure the session keeps using the value that never reached disk — the notice is the only signal, there is no snap-back. That rollback question is deferred to nid_biwdtykvazsk3ejcqqli8o9j7_e (decide).

Tests: npm test 94 files / 1243 tests pass; npm run check clean. Failing-first verified — with the catch body neutralised the 6 new pipeline tests fail.

Follow-ups: nid_biwdtykvazsk3ejcqqli8o9j7_e (decide, in-memory keeps unsaved value), nid_t25rc8sd9nmlbmrn69k4zsaes_e (route pin Notice through the port), nid_o5a1055jyynn9nohpb5rj2vqp_e (pin persist not yet under the policy).

Commits: de425b6, 0e4a39f.
