---
id: nid_025cydqct380d8ik9jhr9hhfn_e
title: "Folder-note descendants: bridge inside-style subfolder notes to level 1"
status: open
deps: []
links: [nid_otmc0t1jlcuwy3g3a3iychvl0_e]
created_iso: 2026-08-13T19:42:36Z
status_updated_iso: 2026-08-13T19:42:36Z
type: task
priority: 3
assignee: CC_WITH-nickolaykondratyev
tags: []
---

## Goal
Reverse the documented "accepted asymmetry" of the folder-note hierarchy: a DIRECT subfolder's inside-style folder note must become a LEVEL-1 DESCENDANT of the parent folder's folder note, making descendants symmetric with the already-working ancestor walk.

Signed off by human 2026-08-13 (plan ticket nid_otmc0t1jlcuwy3g3a3iychvl0_e; decisions recorded there).

## Motivating scenario
```
note1.md              <- sibling-style folder note of note1/
note1/other/other.md  <- inside-style folder note of note1/other/
```
- Ancestors ALREADY work: parentNoteOf("note1/other/other.md") == "note1.md" (src/shared/FolderNotes.ts:102-106). NO code change on the ancestor side — cover with a verifying test only.
- Descendants are the gap: childNotesOf("note1.md") lists only node-bearing files DIRECTLY in note1/, so other.md is never reached (src/shared/FolderNotes.ts:77-92).

## Required change (scope is deliberately minimal)
1. src/shared/FolderNotes.ts — childNotesOf(notePath): per owned folder, ALSO include, for each DIRECT subfolder of the owned folder, that subfolder's winning folder note WHEN it is inside-style (an inside-style note lives one level deeper, so today it is missed). Sibling-style subfolder notes already appear as direct files — must not duplicate (dedupe via the existing `seen` set). Likely needs a direct-subfolder index derivable in fromPaths from nodeBearingFilesByFolder keys (folders only matter if they transitively contain node-bearing files, which that map's keys already imply — derive ancestors of each key).
2. Everything else UNCHANGED: only the subfolder's FOLDER NOTE is pulled to level 1; other files in the subfolder stay level 2 via that note's own children; a subfolder with NO folder note is still NOT bridged (no synthetic folder nodes). The LinkProvider seam, adapters, engine channel dispatch, view, persistence: untouched.
3. Update the owner-locked rule docs to state the new symmetric rule:
   - src/shared/FolderNotes.ts class doc comment ("## The relation" section)
   - docs-internal/plan/high-level-plan.md:76 — REMOVE the "(Asymmetry accepted: ...)" sentence, state the new rule.

## Tests (BDD, start failing-first)
- src/shared/FolderNotes.test.ts:
  - WHEN sibling-root + inside-leaf (the scenario above) THEN childNotesOf("note1.md") contains "note1/other/other.md" (new, currently failing).
  - WHEN subfolder has a sibling-style note THEN no duplicate child.
  - WHEN subfolder has no folder note THEN still not bridged.
  - Ancestor verifying test for the same fixture (parentNoteOf symmetric) if not already covered by lines ~85-102.
- src/engine/hierarchyChannels.test.ts:
  - UPDATE the behavior-capturing test "descendants depth reaches grandchildren only through an intermediate folder note" (~line 112-142) to the new rule — human sign-off for this edit was given on the plan ticket.
  - The "folder without folder note is never bridged" test (~line 139) must STILL pass unchanged.
- Adapter: src/adapters/FolderNoteIndex.ts delegates wholly to FolderNotes — no change expected; keep its tests green.

## Gates
npm test + npm run check. Pure shared/engine change ⇒ no e2e required per CLAUDE.md (view untouched).

## Acceptance Criteria

- childNotesOf returns an inside-style DIRECT-subfolder folder note at level 1; symmetric with parentNoteOf.
- No duplicates for sibling-style subfolder notes; note-less subfolders still not bridged; deeper files still level 2+.
- high-level-plan.md asymmetry note removed; FolderNotes.ts doc comment updated.
- All npm test + npm run check green.

