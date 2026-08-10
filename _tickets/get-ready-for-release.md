---
id: nid_2d67dgjxs5aq6i8hlasxp7tao_e
title: Get ready for release
status: in_progress
deps: []
links: []
created_iso: '2026-08-10T16:33:07Z'
status_updated_iso: '2026-08-10T16:35:42Z'
type: task
priority: 3
assignee: nickolaykondratyev
tags: []
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-1
---
TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve
  and steps of execution and put it into a new ticket 
  (or multiple tickets if it warrants a split across multiple tickets).
  Close this ticket after planning is complete.


Gets this plugin ready for release towards obsidian,
Make sure the naming of the published aligns with obsidian rules (such as having simple name and not having obsidian in it).
Additionally, get the github workflow ready to build artifact upon tagging.
And finally rename the script 'release.sh' to 'release_update_tag.sh' which will 1) make sure we are on default branch and are synced up with origin/deafult branch to start out. Then go through the testing. Once testing is successful it will REV the version (patch version) commit and tag the commit with updated version.
