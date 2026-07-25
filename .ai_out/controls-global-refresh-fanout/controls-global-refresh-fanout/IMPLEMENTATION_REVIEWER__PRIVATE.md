# IMPLEMENTATION_REVIEWER__PRIVATE — controls-global-refresh-fanout

Review iteration 1, commit `caa4e34`. Verdict READY, 0 blocking.

## Verification I actually performed (so a later iteration need not redo it)

- `npm test` → 935/935 pass, 70 files, exit 0 (`.tmp/rev-test.log`).
  `npm run check` → exit 0 (`.tmp/rev-check.log`). Implementation's numbers were honest.
- **Exhaustiveness claim probed empirically**, not assumed: copied
  `settingsWriteScope.ts` to `.tmp/scopecheck/probe.ts` with a local
  `SettingsCommand` union plus a `"NEW-KIND"` member, ran
  `npx tsc --noEmit --strict --noImplicitReturns` → `TS2366`. Guard is real.
- Traced the whole wiring: `main.ts:40` field init → `registerView` factory
  `main.ts:74-82` → `VicinityGraphView` ctor `:32-40` → `onOpen` `:55-70`
  (controller assigned BEFORE `new ControlsActions`) → `refresh()` `:92-94`.
  No null/ordering hazard. Fan-out is sync; per-controller `rebuildToken` is
  latest-wins per view; controllers are independent so no new race.
- Originating-view claim: holds. Panel only exists in an attached loaded leaf;
  `getLeavesOfType` walks root/side/floating splits (popouts included).
- Partition cross-check against `VicinityGraphSettingTab.persist()` (:544-561)
  and `planSettingsWrite` — identical 3/2 split.
- Revert-test: reverting `applySettings` to owningView-only empties
  `refreshedViewIds` → test at `ControlsActions.test.ts:80` fails. Real guard.
- Diff is additive in `src/`; no test/anchor removals (checked `git diff --stat`
  and full diff).

## The one non-obvious finding

All open views follow the active file (`VicinityGraphView.registerGraphEvents`),
and `GraphViewController` has no per-view MAIN lock — so two open views normally
share the SAME MAIN. That makes the per-doc "only concerns the writing view"
comment factually wrong and leaves a sibling-stale hole of exactly the same shape
as the bug being fixed. Not blocking (acceptance criterion 2 asks for the narrow
behaviour) but it is the highest-value follow-up. If a later iteration argues
back, the load-bearing evidence is `VicinityGraphView.tsx:113-118` +
`GraphViewController.handleActiveFileChanged` (:140-151) — there is no path by
which two views hold different MAINs.

Second-highest: `pinNode` fans out even on the not-persistable outcome
(`ControlsActions.ts:56-57`), and that exact branch is the untested one.

## Positions I would defend if challenged

- Pin/unpin fan-out is CORRECT (pinned set is `data.json`, rendered by all views),
  just wider than the ticket text — needs human ack, not rework.
- The two ctor narrowings are genuine layering wins, not test contortions: both
  ports are minimal and follow the existing `obsidianPorts.ts` structural-slice
  pattern; production wiring is unchanged (`this.app.vault`, structural satisfaction).
- Dropping the direct `handleSettingsChanged()` on the global path is safe — I
  checked the enumeration case that would make it a silent regression.
