---
closed_iso: 2026-08-15T02:35:51Z
session_ids: [{"a": "claude", "type": "execution", "id": "e3a7190a-5780-45d5-ba00-aef7a5fbdc0f"}, {"a": "claude", "type": "review", "id": "149f3acd-6521-4d5d-997e-4cfe32053dd5"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_cw2uksuzzotjb53yix9xiz7a2_e
title: "FolderNotes probe is case-sensitive while FileKinds is case-insensitive (decide)"
status: closed
deps: []
links: []
created_iso: 2026-08-15T00:42:38Z
status_updated_iso: 2026-08-15T02:35:51Z
type: task
priority: 4
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [shared]
---

OBSERVATION (low confidence as a practical defect, needs a product decision before a failing test can state correct behavior): src/shared/FolderNotes.ts resolveFolderNote probes exact-case literals (`${folder}/${name}.md`) while src/shared/FileKinds.ts isNodeBearingPath lowercases the extension ("the vault, not the user, decides casing"). So `Jon/Jon.MD` is a graph node but can never be recognised as Jon's folder note — its child/parent hierarchy hops silently vanish. Counterpoint: exact-name case sensitivity arguably matches the Folder Notes plugin convention, and uppercase extensions are rare.

DECIDE: should the folder-note EXTENSION probe be case-insensitive (matching FileKinds) while the NAME half stays exact-case? If yes, add the failing test first: FolderNotes.test.ts, a `.MD` folder-note candidate resolving. If no, document the WHY-NOT next to resolveFolderNote and close.

--------------------------------------------------------------------------------

DECISION: lets go with `.md` for now as that is the main file format that should be used by users, and for now we want to avoid extra complexity of dealing with case-insensitive extensions.

--------------------------------------------------------------------------------

RESOLUTION (2026-08-14): Decision was "no behavior change" — the folder-note
probe stays exact-case (both name and extension). Per the ticket's "if no"
branch, documented the WHY-NOT as a comment inside
`src/shared/FolderNotes.ts` `resolveFolderNote()` (next to the candidate list),
citing this ticket id. No code behavior changed, so no new test was added;
`npm run check` and the existing `FolderNotes.test.ts` (22 tests) pass.
If uppercase-extension folder notes ever become a real user complaint, the fix
point is the `candidates` array in `resolveFolderNote` — and the failing test
to start from is the one this ticket originally sketched (a `Jon/Jon.MD`
candidate resolving).

