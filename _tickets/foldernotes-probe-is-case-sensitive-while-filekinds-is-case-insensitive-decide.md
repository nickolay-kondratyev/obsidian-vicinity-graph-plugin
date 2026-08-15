---
id: nid_cw2uksuzzotjb53yix9xiz7a2_e
title: "FolderNotes probe is case-sensitive while FileKinds is case-insensitive (decide)"
status: open
deps: []
links: []
created_iso: 2026-08-15T00:42:38Z
status_updated_iso: 2026-08-15T00:42:38Z
type: task
priority: 4
assignee: CC_WITH-nickolaykondratyev
parent: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
tags: [shared, decide]
---

OBSERVATION (low confidence as a practical defect, needs a product decision before a failing test can state correct behavior): src/shared/FolderNotes.ts resolveFolderNote probes exact-case literals (`${folder}/${name}.md`) while src/shared/FileKinds.ts isNodeBearingPath lowercases the extension ("the vault, not the user, decides casing"). So `Jon/Jon.MD` is a graph node but can never be recognised as Jon's folder note — its child/parent hierarchy hops silently vanish. Counterpoint: exact-name case sensitivity arguably matches the Folder Notes plugin convention, and uppercase extensions are rare.

DECIDE: should the folder-note EXTENSION probe be case-insensitive (matching FileKinds) while the NAME half stays exact-case? If yes, add the failing test first: FolderNotes.test.ts, a `.MD` folder-note candidate resolving. If no, document the WHY-NOT next to resolveFolderNote and close.

