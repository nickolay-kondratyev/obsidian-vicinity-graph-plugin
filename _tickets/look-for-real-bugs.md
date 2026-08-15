---
closed_iso: 2026-08-15T00:43:43Z
id: nid_1gpbw8a2a3p09ny3kjl0u0az5_e
title: Look for real bugs
status: closed
deps: []
links: []
created_iso: '2026-08-15T00:17:06Z'
status_updated_iso: 2026-08-15T00:43:43Z
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Look for any real bugs. 
IF you find the likely bugs create a follow up ticket to handle them. The tickets MUST root cause and have failing test.

## Notes

**2026-08-15T00:43:43Z**

Bug hunt complete: 8 verified bugs filed as child bug tickets (each with root cause + committed known-bug test, skipped so the build stays green) + 1 decide task (FolderNotes case sensitivity). Tests live in the suites next to the buggy code; UNSKIP (it.skip -> it) as each fix's acceptance.
