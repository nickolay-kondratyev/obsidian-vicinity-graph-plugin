---
closed_iso: 2026-08-17T18:14:02Z
session_ids: [{"a": "claude", "type": "execution", "id": "80371a35-bf27-42b5-8f88-6e3967486a83"}, {"a": "claude", "type": "review", "id": "9f742a4d-3a2d-4f3f-80cd-eb3a6b7cf708"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_rt0dyx6chv7fxae4k7q85f53l_e
title: "Implement: create-child-note hover chip on main folder note"
status: closed
deps: []
links: [nid_mgp572ljuxzajfrb64gkiyreq_e]
created_iso: 2026-08-17T17:06:10Z
status_updated_iso: 2026-08-17T18:14:02Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

PLAN (signed off by human 2026-08-17; supersedes planning ticket nid_mgp572ljuxzajfrb64gkiyreq_e, see its body for the Q/A log).

## Requirement
WHEN the MAIN node of the vicinity graph is a folder note (per the existing convention in src/shared/FolderNotes.ts: `Jon/Jon.md` preferred, or sibling `Jon.md` next to `Jon/`)
THEN hovering the node reveals a chip in the bottom-right corner INSIDE the note body (does not collide with the edge/corner drag-resize handles or bottom attachment chips)
AND clicking it creates a new child note INSIDE the folder (`Jon/Untitled.md`, deduped `Jon/Untitled 1.md`, ... — Obsidian core naming convention), created EMPTY, and opens it in the active editor. The new note becomes the active file, so the graph re-centers on it as MAIN via the normal active-file-change path (the vault `create` event already stales FolderNoteIndex).

Signed-off decisions:
- Placement: bottom-right, inside the node (hover-revealed like the other chips).
- Icon: lucide `file-plus-2` via the existing GraphUiPort.renderIcon seam; aria-label/tooltip "Create child note".
- Flow: immediate create + open in editor; NO name prompt.
- Sibling pattern `Jon.md` + `Jon/`: child goes inside `Jon/`. Conflicts already resolved by FolderNotes precedence (`Jon/Jon.md` wins).
- Scope guard: ONLY main + already-a-folder-note. NOT in scope: converting a plain note into a folder note, canvas children, templated content.

Review amendments (signed off by human 2026-08-17, second `.out/current_decision.md` round):
- **Chip predicate REQUIRES folder existence, checked through the VAULT.** FolderNotes is built from FILE paths only, so its candidate rule makes EVERY plain note `X.md` the "folder note" of `X/` even when `X/` does not exist — ownership alone would put the chip on every main note and clicking would mint the folder (the out-of-scope conversion). Predicate = FolderNotes ownership AND the owned folder EXISTS in the vault (e.g. `getFolderByPath`-shaped check on the new port; an EMPTY existing folder is invisible to the path-set index, so this check can never go through FolderNoteIndex).
- **Empty-folder edge (Decision 1 = A):** `Jon.md` next to an existing but EMPTY `Jon/` → chip SHOWS; first child lands as `Jon/Untitled.md`.
- **Dual ownership (Decision 2 = A):** a note can win TWO folders (`Jon/Jon.md` owns `Jon/` inside-style and can simultaneously win `Jon/Jon/` sibling-style). `ownedFolderOf` picks the INSIDE-owned folder — `Jon/Jon.md` → child goes in `Jon/` — consistent with the location-dominates precedence.

## Design sketch (follow repo layering: view -> adapters -> engine)
1. FIRST vault write in the codebase: src/adapters/obsidianPorts.ts VaultPort is read-only today. Add a separate small write seam (OCP - new interface, do not widen VaultPort), e.g. `NoteCreationPort { create(path, content): Promise<TFile-ish>; folderExists(folder): boolean }`, implemented over `app.vault.create` + `app.vault.getFolderByPath` (the folder-existence half of the chip predicate — see Review amendments; it can NOT come from FolderNoteIndex). Open-in-editor needs NO new seam: `GraphUiPort.openNote` already exists (src/view/viewPorts.ts). Keep it ONE cohesive adapter class (suggest src/adapters/ChildNoteCreator.ts) owning: resolve target folder for a folder-note path (pure logic belongs in src/shared/FolderNotes.ts - add `ownedFolderOf(notePath)` promoting the private `foldersOwnedBy`, INSIDE-owned folder wins on dual ownership per Decision 2), dedupe untitled name against existing files READ FRESH from the vault at click time (never the rendered graph snapshot — same rule as settings), create, open. Pure name/folder logic gets BDD unit tests with Fake ports.
2. View wiring: NoteNode.tsx renders the chip only when tier === "main" AND the node is a folder note. Expose that as a boolean on FlowNodeData (computed in src/view/GraphViewController.ts / flowMapping via FolderNoteIndex - do NOT import obsidian into flowMapping; pass a predicate or precomputed flag). Click routes through ControlsActionsPort as a new action (e.g. `createChildNote(mainPath)`), same pattern as existing pin/resize actions. Chip carries nodrag/nopan classes like the other chips; CSS hover-reveal in src/view/*.css consistent with existing chip styling.
3. Failure policy: a failed create reports ONCE via UserNoticePort (plain-language message), never throws to React. NOTE: this is a vault-content write, NOT a data.json write - it does NOT go through settingsWritePipeline/runGuarded; keep it a simple try/catch + notice inside the adapter action.

## Testing (repo gates)
- BDD unit tests: folder-note -> target folder resolution (both patterns + conflict + DUAL ownership picks inside-owned), untitled dedupe, and the predicate edges the naive implementation gets wrong: plain note whose would-be folder does NOT exist -> no chip; existing-but-EMPTY owned folder -> chip.
- Component test: extend the EXISTING src/view/NoteNode.component.test.tsx — chip renders only for main+folder-note, has aria-label "Create child note"; include a node WITH an attachment strip (the bottom-right corner is crowded: strip + corner resize grip).
- e2e (REQUIRED - this is view-layer DOM behavior): spec in e2e/ submodule - open a vault with a folder note as active file, hover main node, click chip, assert `Jon/Untitled.md` exists and became the active file / new MAIN. Remember: commit e2e submodule changes before committing this repo.
- Gates: npm run check, npm test, npm run test:e2e (at minimum the touched spec).

## Acceptance criteria
- Chip appears ONLY on hover of the MAIN node when it is a folder note (both patterns) whose owned folder EXISTS (empty folder counts); never on non-main nodes, non-folder-note nodes, or a note whose would-be folder does not exist.
- Click creates an empty, correctly-deduped child inside the owned folder and opens it; graph re-centers on it.
- Resize handles and attachment chips still work (no hit-area collision).
- Failure to create shows one user notice and leaves the graph usable.
- All gates green incl. the e2e spec covering this surface.

---

## RESOLUTION (2026-08-17)

Implemented as specified. All gates green: `npm run check`, `npm test` (2228 passed),
and `npm run test:e2e -- createChildNote.e2e.ts`.

### What was built, where it lives

Pure logic (`src/shared/`, import-guarded):
- `FolderNotes.ownedFolderOf(notePath)` — promotes the private `foldersOwnedBy`; returns
  the INSIDE-owned folder on dual ownership (Decision 2). NOTE: because the folder-note
  rule is path-only, EVERY plain note `X.md` sibling-owns its namesake folder `X/` even
  when `X/` does not exist — that is exactly why the chip predicate needs a live folder
  existence gate (see below). This surprised the first test draft; the corrected test in
  `FolderNotes.test.ts` documents it.
- `ChildNoteNaming.untitledChildPath(folder, exists)` — Obsidian's `Untitled` /
  `Untitled 1` / … dedupe against a caller-supplied existence predicate.

Adapters (`src/adapters/`):
- `NoteCreationPort` (in `obsidianPorts.ts`) — the plugin's FIRST vault-WRITE seam
  (`create` + `folderExists`), separate from the read-only `VaultPort` (OCP).
- `ObsidianNoteCreation` — adapts `Vault.create` + `Vault.getFolderByPath` (both present
  on the pinned 1.12.3 typings). Real `Vault` does NOT satisfy the port structurally
  (`getFolderByPath` returns a folder, not a boolean), hence the hand-written adapter.
- `FolderNoteIndex.ownedFolderOf` — delegates to `FolderNotes` (branded `FolderPath`).
- `ChildNoteCreator` — the whole action: resolve owned folder → dedupe against the vault
  READ FRESH at click time → `create("")` → open in the current tab. Its own one-notice
  failure policy lives here (a vault-content write; NOT on the settings/`runGuarded` chain).
  Unit-tested with fakes in `ChildNoteCreator.test.ts`.
- `VicinityGraphBuilder` — gains the `NoteCreationPort` and computes
  `GraphBuildResult.mainIsFolderNote = ownedFolderOf(main) exists && folderExists(...)`.

View (`src/view/`):
- `FlowNodeData.offersChildNoteCreation` (set in `flowMapping.ts`, true only on the MAIN
  when `mainIsFolderNote`); `GraphViewController` threads `result.mainIsFolderNote` into
  `vicinityGraphToFlow`.
- `ControlsActionsPort.createChildNote(mainPath)` + `ChildNoteCreatorPort` (in
  `viewPorts.ts`); `ControlsActions.createChildNote` delegates to the `ChildNoteCreator`.
- `NoteNode.tsx` — `ChildNoteButton` (lucide `file-plus-2`, aria-label/title "Create child
  note"), rendered bottom-right, gated on `data.offersChildNoteCreation`.
- `graph-view.css` — `.vicinity-graph-child-note-button` reuses the shared
  `.vicinity-graph-node-chip` chrome / size-ladder / withhold rungs, overriding only the
  vertical anchor to bottom-right (mirrors the gear's top inset, clears the bottom/right
  resize grip bands + corner handle).

Wiring: `main.ts` builds one plugin-lived `ObsidianNoteCreation`, passes it to the builder
AND to each `VicinityGraphView` (alongside `folderNoteIndex`); the view builds the
`ChildNoteCreator` in `onOpen` (the navigator's `openNote` satisfies `NoteOpenPort`).

### Tests
- Unit: `FolderNotes.test.ts` (ownedFolderOf + the "sibling-owns-namesake" surprise),
  `ChildNoteNaming.test.ts`, `ChildNoteCreator.test.ts`, `VicinityGraphBuilder.test.ts`
  (mainIsFolderNote predicate incl. empty-folder edge + would-be-folder-absent),
  `flowMapping.test.ts` (flag only on MAIN), `ControlsActions.test.ts` (delegation + no
  settings fan-out).
- Component: `NoteNode.component.test.tsx` (chip only on main+folder-note, aria-label,
  click routes path, coexists with an attachment strip, `file-plus-2` glyph).
- e2e: `e2e/createChildNote.e2e.ts` — hover the MAIN folder note, click the chip, assert
  `Jon/Untitled.md` created + active + new MAIN.

### Notes for the next reader
- The e2e spec lives in the `e2e/` submodule; per CLAUDE.md it must be committed there
  before the parent repo commit. This session did NOT run `git commit` (harness policy:
  commit only when asked). The working tree carries all edits + rebuilt `main.js`/
  `styles.css` artifacts; the e2e submodule already had UNRELATED pre-existing
  modifications from other work — stage only `e2e/createChildNote.e2e.ts` there.

