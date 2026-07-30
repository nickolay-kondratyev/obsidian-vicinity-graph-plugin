# Private notes / process log

- Used `ticket show <id>` CLI (works in this env) to pull full ticket bodies
  for nid_4zffe7mj5p1eabi9m6wfh06k0_e, nid_8b97fdqznqsncc5kgya1p871w_e,
  nid_m5hxe4eo9jgt7cfic7s2o3uvi_e — all confirmed consistent with
  docs-internal/notes/settings.md's chain table.
- Did not find any WIP/uncommitted branch changes for a "SerialPromiseChain"
  yet — src/shared/ has zero async helpers today, confirmed via find.
- Traced the two known bugs to exact line numbers by reading
  VicinityGraphSettingTab.ts in full (899 lines) rather than trusting
  grep alone — worth re-reading if the file changes before the real fix PR,
  since line numbers WILL drift.
- The "descriptor model" is NOT a single file/type — this surprised me
  initially since ticket 5's ask (§5) phrased it as one model. Confirmed via
  settings.md's own "Ratified by the owner" note that the literal one-array
  ask was declined in favor of "compile-forced N declarations". Don't let a
  future task assume there's one `SettingsFieldDescriptor[]` array to import.
- ControlsActions.ts has literally no queue — worth flagging explicitly since
  the ticket text only names 3 chains + focuses on tab-side bugs; the panel
  write path's total absence of serialization (beyond PluginDataStore's own)
  is a 4th site that a "one serial chain" refactor should probably also route
  through, though the ticket doesn't explicitly ask for that — flagged as an
  open question for whoever picks this up.
- Did not run `npm test` / `npm run check` — pure read/explore per role.
- Did not read GraphViewController.ts in full (899-line style file, ~350
  lines) — only grepped for refresh/rebuildToken to confirm latest-wins
  claim in architecture-map.md holds. Could go deeper if the pipeline ticket
  ends up touching per-view refresh timing (it shouldn't, per settings.md
  scope-change note: fan-out is now trivial, "all writes are global and fan
  out to all views").
- Files read in full: PluginDataStore.ts, settingsDebounce.ts,
  settingsWriteQueue.ts, SettingsSpec.ts, settingsSectionFields.ts,
  settingsResetPlan.ts, ControlsActions.ts, ControlsModel.ts,
  SizingSection.tsx, GlobalDepthControls.tsx, DepthStepper.tsx,
  GraphToolbar.tsx. VicinityGraphSettingTab.ts read in two large chunks
  (L90-310, L800-899) plus grep for the rest — should be enough coverage of
  the write/reset path but I did not read the render*() section-building
  methods (L310-800) in detail; those are UI-row-building, not
  write-pipeline logic, so skipped deliberately.
