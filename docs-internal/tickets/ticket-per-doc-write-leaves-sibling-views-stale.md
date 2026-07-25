# Ticket: a per-doc settings write leaves sibling views showing the same MAIN stale

**Status:** OPEN — defect, small fix, needs a human call on the desired UX.
**Origin:** IMPLEMENTATION_REVIEW of the controls global-refresh fan-out
(ticket `nid_u36pqr4zljs44jt42lk9ln8ry_e`). That ticket's acceptance criteria
explicitly required per-doc writes to keep their narrower behaviour, so this was
recorded rather than fixed there.

## The defect

Open two vicinity-graph views (e.g. one in the main area, one in the sidebar or a
popout). Change a **depth stepper** in one of them.

- The writing view rebuilds and shows the new depth.
- The other view keeps showing the OLD depth until something else triggers its
  rebuild.

## Why it happens (evidence — do not re-derive)

The narrow per-doc branch is justified in `src/view/settingsWriteScope.ts` by
"a per-doc write concerns only the writing view". That is a **scope decision,
not an invariant**: nothing insulates sibling views.

- `VicinityGraphView.registerGraphEvents` (`src/view/VicinityGraphView.tsx`)
  wires `workspace.on("active-leaf-change")` and `workspace.on("file-open")` →
  `controller.handleActiveFileChanged(...)` **for every view**.
- `GraphViewController` has no per-view MAIN lock — there is no "pin this leaf to
  this note" feature.

⇒ Two open views normally track the SAME active file, hence the same MAIN, hence
the same doc-data. This is the *common* configuration, not an edge case.

`ControlsActions.applySettings` routes per-doc writes to
`owningView.handleSettingsChanged()` (one view) while global writes go through
`ViewsRefreshPort.refreshAllViews()` (all views).

## Fix sketch (small — the decision is already isolated)

`settingsWriteScope(command)` is the single branch point. Either:

- **(a)** collapse the classifier so every command is `global` scope — then
  `settingsWriteScope` and the `SettingsWriteScope` type lose their reason to
  exist and should be deleted, not left as a one-valued enum; or
- **(b)** keep the classifier and fan per-doc writes out too, if a future
  per-view MAIN lock is expected (then the two scopes stay meaningfully
  different).

Flip the two per-doc tests in `src/view/ControlsActions.test.ts`
("THEN only the originating view rebuilds" / "THEN the other open views are left
alone") to the new expectation — do NOT delete them.

## Decide first

Which of (a)/(b): is a per-view MAIN lock ("pin this graph to this note") on the
roadmap? If yes, (b). If no, (a) is simpler and removes a now-pointless
abstraction.

## Cost note

Fanning out multiplies rebuilds by the number of open views; on a slider/stepper
drag that is N builds+layouts per `onChange`. Each controller absorbs bursts
latest-wins via `rebuildToken`, and the settings tab already fans out this way,
so this is acceptable — but it is the same cost pressure as
`ticket-controls-optimistic-input-latency.md`; land that first if input latency
is already a complaint.
