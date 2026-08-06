---
closed_iso: 2026-08-06T16:11:11Z
id: nid_q3rscvfkznktgu1cqyybp54v1_e
title: bug - when note is renamed the vicinity graph is lost
status: closed
deps: []
links: []
created_iso: '2026-08-03T23:39:21Z'
status_updated_iso: 2026-08-06T16:11:11Z
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
---
BUG:
WHEN we rename a markdown note THEN We get "No vicinity graph for active file".
Even though we are in the same renamed note.

EXPECTED: behavior we get new rendering of vicinity graph with updated name of the note.

## Resolution (2026-08-06) — FIXED

### Root cause
Renaming an open note IN PLACE fires `vault.on('rename')` but NEITHER
`workspace.on('file-open')` NOR `workspace.on('active-leaf-change')` — the same
note stays open, only its path changes. `GraphViewController` tracks the central
note by path (`mainPath`) and only re-points it from those two workspace events
(`src/view/VicinityGraphView.tsx` `registerGraphEvents`). So after a rename
`mainPath` still held the OLD path; the next rebuild called
`graphBuilder.build(oldPath)`, which returns `null` (file no longer at that path)
→ the empty snapshot → "No vicinity graph for the active file." under the still-open note.

### Fix
- `src/view/GraphViewController.ts`: new entry point `handleMainRenamed(oldPath, newPath)`.
  If `oldPath === this.mainPath` it drops any pending debounce, re-points
  `mainPath` to `newPath`, and rebuilds. A rename of any OTHER file is a no-op
  (its link-graph effects arrive via the existing metadata-resolve path).
- `src/view/VicinityGraphView.tsx`: `registerGraphEvents` now also registers
  `this.app.vault.on("rename", (file, oldPath) => controller.handleMainRenamed(oldPath, file.path))`.
  Plugin-level rename bookkeeping (pathDocIdMap move + canvas-cache evict in
  `main.ts`) is unchanged and, being registered first at load, runs before this
  view handler's rebuild.

### Tests
- Failing-first unit tests in `src/view/GraphViewController.test.ts`
  ("GraphViewController main rename"): rebuild against the NEW path; MAIN re-points
  so re-activating the new path is a no-op; a non-MAIN rename triggers no rebuild.
- End-to-end regression `e2e/noteRename.e2e.ts` drives a REAL Obsidian rename
  (`vault.rename` via new `ObsidianHarness.renameFile`) and asserts the graph
  re-centers on the new path instead of showing the empty state.
  (WHY-NOT `fileManager.renameFile`: its link-rewrite pass hangs the evaluate in
  the headless build; `vault.rename` fires the same `vault.on('rename')` this fix
  listens to.)

### Verification
`npm run check` ✓, `npm test` (1656) ✓, `npm run check:e2e` ✓,
`npm run test:e2e -- noteRename.e2e.ts` ✓.
