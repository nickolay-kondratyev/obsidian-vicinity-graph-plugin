---
id: nid_mw1az1i1aznfoxqsgcwnfus07_e
title: Add procesing for external URL in the graph
status: open
deps: []
links: []
created_iso: '2026-08-04T16:55:26Z'
status_updated_iso: '2026-08-06T23:17:27Z'
type: task
priority: 4
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin-mirror-4
---

TASK: **PLAN**. Lets clarify any gaps that exist for this ticket
  (if you need to explore code base use cheaper Explore-cheap sub-agent)
  ask human any questions that come up that require human decision.
  Finally create detailed plan with requirements of what we want to achieve
  and steps of execution and put it into a new ticket 
  (or multiple tickets if it warrants a split across multiple tickets).
  Close this ticket after planning is complete.


Let's add processing of external URLs so that we are able to see what is the central node or the pinned node links out to.

What I am thinking here is being able to see the external links that the central node links out to. I am thinking is that we want to avoid rendering entire URL page. We also want to avoid the network calls for now as that can greatly limit the adoption and trust of a plugin. So I am thinking for now we will only render URL links that have aliases. To avoid having to fetch the URL links and get flagged for network calls (unless obsidian has some API to fetch the data from the links without getting flagged for network calls). IF we cannot get fetch the data through obsidian API withouit getting flagged for network calls then I am thinking we limit the URL rendering only to the URLs that have aliases.

We will want to have a different UI node element for the URL rather than the note so its clear to the user that this is not a local element. (As part of planning lets create a dependency to create multiple proposals of the element design for the human to pick (I am thinking a showcase of 10 different nodes to choose one from)) 

TO start out we will just render the URLs from the Pinned and Central nodes. However, we will want to have a follow-up ticket to add a PILL like configuration in the 'Depth' configuration which will control whether the URLs are rendered or not.
