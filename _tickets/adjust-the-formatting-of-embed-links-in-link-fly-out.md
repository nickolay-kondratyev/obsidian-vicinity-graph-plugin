---
id: nid_0dle910iia37t42t28dqndc5b_e
title: Adjust the formatting of embed links in link fly out
status: in_progress
deps: []
links: []
created_iso: '2026-08-06T16:44:37Z'
status_updated_iso: '2026-08-06T16:47:17Z'
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
Right now the formatting has odd `<< >>` this is left over from prompting. When it comes to embedded note links lets just render the `![[note-link]]` as is in the link fly out panel. That means `![[note-link|alias]]` would render just as is in the link fly out if the link is embedded WITHOUT being rendered as markdown at all for now. 

So in other words if the link is embedded link then it is drawn as raw markdown not as rendered markdown in the link fly out.
