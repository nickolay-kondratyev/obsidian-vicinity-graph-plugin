---
closed_iso: 2026-08-10T17:47:05Z
id: nid_o9hmeo92x5dkmtz5lfzr5jk0s_e
title: Obsidian naming/metadata compliance pass for release
status: closed
deps: []
links: [nid_ryf59psd6sj5rsj7pha7zc7yk_e]
created_iso: '2026-08-10T16:38:49Z'
status_updated_iso: 2026-08-10T17:47:05Z
type: task
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [release, decide]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-2
---
Final Obsidian community-plugin metadata compliance pass before release. Split out of planning ticket nid_2d67dgjxs5aq6i8hlasxp7tao_e ("Get ready for release"). Small, mostly verification.

OPEN DECISIONS in .out/current_decision.md (Q5 description wording, Q6 isDesktopOnly). Tagged `decide` — confirm with human.

== Already compliant (verify, do not change) ==
- manifest.json `id` = `vicinity-graph` (no `obsidian-` prefix), `name` = `Vicinity Graph` (no "Obsidian"/"plugin" in the name). Good per Obsidian guidelines.
- Version 0.1.1 agrees across package.json / manifest.json / versions.json.

== To do ==
1. Q5: Reword manifest.json + package.json `description` to DROP the word "Obsidian" (review guidance discourages "Obsidian"/"plugin" in metadata and over-long descriptions). Proposed: "A richer local graph of the notes near your active note — a folder-grouped alternative to the built-in local graph." Confirm final wording with human, then set it in BOTH manifest.json and package.json (they currently match; keep them matching). Update README.md if it quotes the description.
2. Q6: Decide isDesktopOnly. manifest.json has `false` but README says mobile is UNTESTED. Either (a) flip to `true` (honest), or (b) run a mobile smoke pass and keep `false`. Get human decision; if flipping, update RELEASE_CHECKLIST.md §4 note accordingly.
3. Re-verify RELEASE_CHECKLIST.md §4 field checklist ticks true for the final metadata.

== Out of scope ==
Repo rename / community-store submission PR / any id rename (deferred per RELEASE_CHECKLIST.md §Out of scope). The GitHub repo slug containing "obsidian" is fine — the naming rule constrains plugin id/name, not the repo.

== Acceptance ==
- Description contains no "Obsidian"/"plugin", is concise, and matches in manifest.json + package.json.
- isDesktopOnly decision recorded and applied.
- RELEASE_CHECKLIST.md §4 reflects final state.
- change_log entry after completion.

== RESOLUTION (2026-08-10, DONE) ==
Human decided both `decide` questions:
  - Q5: accepted proposed wording. `description` in BOTH manifest.json and
    package.json is now "A richer local graph of the notes near your active note
    — a folder-grouped alternative to the built-in local graph." — no
    "Obsidian"/"plugin", concise, and the two files match (verified).
  - Q6: isDesktopOnly flipped `false` → `true` (honest for V1; mobile untested,
    no mobile smoke pass available). RELEASE_CHECKLIST §4 updated to record
    desktop-only as the intentional V1 stance.

Also verified already-compliant items unchanged (id=vicinity-graph, name=Vicinity
Graph, version 0.1.1 across manifest/package/versions). README neither quotes the
description nor mentions desktop/mobile → no downstream doc edits. Ticked all of
RELEASE_CHECKLIST §4; fixed two stale "0.1.0" version refs in §3/§5 to 0.1.1 while
there. Acceptance criteria all met.

(Prior `.out/current_decision.md` holding Q5/Q6 had been overwritten by an
unrelated ticket's decision; the questions were re-staged there before deciding.)
