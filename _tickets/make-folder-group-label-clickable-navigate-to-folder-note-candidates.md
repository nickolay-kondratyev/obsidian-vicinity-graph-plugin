---
closed_iso: 2026-08-15T03:26:51Z
session_ids: [{"a": "claude", "type": "execution", "id": "9bc8f156-56c0-4736-abe7-3ddae6c697fb"}, {"a": "claude", "type": "review", "id": "8b783439-2802-49ae-b85f-1ee4655c2c97"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
id: nid_2pobjyfp5zgspx283bfukaugn_e
title: "Make folder-group label clickable: navigate to folder-note candidates"
status: closed
deps: []
links: [nid_s28ucpwyu62674ndvbzst8nct_e]
created_iso: 2026-08-15T03:08:44Z
status_updated_iso: 2026-08-15T03:26:51Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: []
---

APPROVED PLAN (owner sign-off 2026-08-15, see closed ticket nid_s28ucpwyu62674ndvbzst8nct_e). Scope: make the folder-group NAME LABEL in the vicinity graph clickable, navigating to the folder's folder-note candidate(s). The original "place folder-note node at top-right of the group" idea was DROPPED by the owner — do NOT implement any layout/placement change.

## Requirements (signed off)
- R1: Clicking a folder-group's name label navigates to that folder's folder-note candidate(s). "Candidates" is a NEW, navigation-only concept: the existing files among `X/<name>.md`, `X/<name>.canvas`, sibling `<name>.md`, sibling `<name>.canvas` (precedence order, max 4). The owner-locked single-winner traversal rule in src/shared/FolderNotes.ts (plan nid_ri1d36t7hmhu0kr652wny1dmz_e) is UNTOUCHED.
- R2: Exactly 1 candidate -> open it directly. 2+ candidates -> Obsidian-native Menu at the click position listing all candidates (precedence order, labeled by vault path); selecting one opens it.
- R3: Works whether or not the candidate note is a discovered/visible graph node.
- R4: Chain-collapsed groups (label like `A/B/C`): only the DEEPEST folder (the group's `folder` field in src/view/folderGrouping.ts) is eligible.
- R5: Click semantics mirror regular node clicks (src/view/VicinityGraphFlow.tsx onNodeClick): plain click -> current tab (graph rebuilds around opened note), ctrl/cmd-click -> new tab. For menu selections, current-tab is acceptable v1 (honor modifiers if the Menu item callback event makes it trivial).
- R6: 0 candidates -> label inert (no pointer cursor, no handler, unchanged muted styling). 1+ -> pointer cursor + hover accent via Obsidian theme CSS variables, CSS-only.

## Design

## Design sketch
- `FolderNotes.folderNoteCandidatesOf(folder): readonly string[]` in src/shared/FolderNotes.ts — pure, existing candidates in precedence order (reuse the candidate-list logic in resolveFolderNote; DRY it so winner + candidates share ONE candidate table). Memoise like folderNoteOf.
- Expose through src/adapters/FolderNoteIndex.ts (already wraps FolderNotes with vault-event invalidation).
- Thread per-group candidates into `FlowGroupData` (src/view/flowMapping.ts) so the label knows at render time whether it is interactive (R6). flowMapping needs a folder->candidates lookup supplied per rebuild — add a small port (view-defined interface, adapter implements; follow the LinkProvider/viewPorts.ts pattern). Keep layering: view -> adapters; engine untouched.
- src/view/FolderGroupNode.tsx: label becomes interactive when candidates non-empty. Node components cannot reach the controller directly — follow the NoteOpenPort/NoteOpenContext pattern (src/view/viewPorts.ts, wired in src/view/VicinityGraphFlow.tsx ~176-179). stopPropagation on the label click so group drag / React Flow onNodeClick are unaffected; GraphViewController's isFolderGroupId guards on openNode/focusNode stay as-is.
- New small port for the multi-candidate menu, implemented in src/adapters/ with Obsidian `Menu` (showAtMouseEvent); provide a `Fake*` for tests (repo convention).
- Styling in src/view/graph-view.css (styles.css is GENERATED — never hand-edit).

## Tests
- BDD unit tests (WHEN/THEN) for folderNoteCandidatesOf, colocated.
- jsdom component test for the label (affordance present only with candidates; click dispatches through the fake port) — per-file `@vitest-environment jsdom` pragma, harness pattern per src/view/testFixtures/.
- e2e REQUIRED (view-layer DOM/CSS change, per CLAUDE.md): spec in the e2e submodule — single-candidate label click navigates; zero-candidate label is inert. Commit the e2e submodule BEFORE committing this repo.
- Start from failing tests.

## Acceptance Criteria

- Label with 1 candidate: click opens the note in current tab; ctrl/cmd-click opens in new tab.
- Label with 2+ candidates: click shows Obsidian Menu with all candidates in precedence order; selecting one opens it.
- Label with 0 candidates: no pointer cursor, click does nothing.
- Works for undiscovered candidate notes (not in the graph).
- Chain group `A/B/C` uses only C's candidates.
- No change to traversal/folder-note-winner semantics; src/engine/ untouched; importGuard tests green.
- npm run test:all green (including e2e vicinityGraph surface).

## Resolution (2026-08-15)

Implemented as planned, with one deliberate deviation from the design sketch (noted below).

**What was built, where:**
- `src/shared/FolderNotes.ts` — `folderNoteCandidatesOf(folder)`: every EXISTING candidate in precedence order, memoised; the candidate table was extracted into one private `candidatePathsOf()` shared with `resolveFolderNote` (winner = index 0, DRY). Traversal rule untouched.
- `src/adapters/FolderNoteIndex.ts` — `folderNoteCandidatesOf(folder: FolderPath): readonly VaultPath[]`, same warmed snapshot + `markStale` invalidation as the other reads.
- `src/view/flowMapping.ts` — new `FolderNoteCandidatesLookup` interface; `vicinityGraphToFlow` takes it as a required 3rd param; `FlowGroupData.folderNoteCandidates` carries the DEEPEST folder's candidates only (`group.folder`, R4).
- `src/view/viewPorts.ts` — `GraphBuildResult.folderNoteCandidates` carries the lookup per build; `src/adapters/VicinityGraphBuilder.ts` hands out its own `FolderNoteIndex` (same snapshot the engine's hierarchy channels read). `GraphViewController` threads it through.
- `src/view/FolderGroupNode.tsx` — label click handler: stopPropagation; 1 candidate → `NoteOpenPort.openNote` with `opensInNewTab(event)` (R5); 2+ → native menu; 0 → NO handler attached and no modifier class (R6). Modifier class: `vicinity-graph-group__label--navigable`.
- `src/view/graph-view.css` — `--navigable` modifier: `cursor: pointer` + `--text-accent` on hover, CSS-only.

**Deviation (sketch, not requirements):** the sketch proposed a NEW port for the multi-candidate menu. The existing `GraphUiPort.showNodeMenu` (native `Menu.showAtMouseEvent`, already context-delivered to node components, already faked in tests) is exactly that seam, so it was reused instead of minting a duplicate menu port (DRY; entries are title-only, labelled by vault path, precedence order). Menu selections open current-tab (sanctioned v1 — the `NodeMenuEntry.onClick` seam carries no modifier state).

**Tests:** BDD units in `FolderNotes.test.ts` (candidates describe) + `FolderNoteIndex.test.ts`; `flowMapping.test.ts` (group data carries candidates; collapsed chain queries ONLY `wiki/lang/en`); new jsdom `src/view/FolderGroupNode.component.test.tsx` (affordance/inert, plain vs ctrl click, menu dispatch through fakes); e2e `e2e/folderGroupLabelNav.e2e.ts` (inert label; single-candidate click navigates to an UNDISCOVERED sibling folder note and re-centres MAIN — R3). Verified: `npm run check`, `npm test` (2131 passed), `npm run test:e2e -- folderGroupLabelNav.e2e.ts` (2 passed) and `-- nestedGrouping.e2e.ts` (9 passed) on the pinned Obsidian 1.12.7 headless.

**Found while working (out of scope, filed):** the e2e submodule working tree held an uncommitted +148-line "Edge depth into groups" addition to `nestedGrouping.e2e.ts` from an earlier feature — left untouched; follow-up ticket `nid_4uaakunhzxq4ur9l1qxe04zb7_e` (tagged `decide`).


## Notes

**2026-08-15T03:31:17Z**

__READY_AS_IS__: review found one bug (navigable label missing nodrag/nopan — pan released over label fired navigation), fixed in b32078d matching the NoteNode-chip pattern, covered by 2 new component tests; check + npm test (2133) + folderGroupLabelNav e2e all green.
