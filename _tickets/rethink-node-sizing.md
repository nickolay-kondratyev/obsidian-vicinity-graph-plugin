---
id: nid_kyowb4v8v51nslbicl4szgcd5_e
title: rethink node sizing
status: in_progress
deps: []
links: []
created_iso: '2026-08-01T01:26:15Z'
status_updated_iso: '2026-08-03T23:45:40Z'
type: task
priority: 3
assignee: nickolaykondratyev
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
Let's rethink how we do node sizing in the graph.  Right now its by default tied to the amount of information that is in the node. Which sometimes is in alignment and other times it's not. 

Right now I am thinking we move away from our node sizing that we had based on the size and move towards combining the node content and the node sizing dials. 

Another UX that would feel much more natural is extending the node size. I would like the node size to be able to be extended so that we can drag the node edges to set custom size of the node (possibly smaller than it was). If needed for performance and UX we could wait to re-render the graph until the resize is done. 

The custom adjustments to the node would be globally stored, I am thinking that we would store the adjustments in the following fashion: 
- IF node has an id we would store the adjustments by ID (frontmatter id for a markdown note OR `metadata.frontmatter.id` if its canvas)
- IF node does not have and ID we would add one. 
  - See https://www.npmjs.com/package/obsidian-id-lib and then store the adjustments by ID. We would only assign the id if we needed to save the settings.
The adjustments would be stored by ID but globally for now so that adjustments apply to nodes no matter from which node we are looking at.

Some of the things we want to avoid:
- central node shown big even if it doesn't have any content.
- pinned nodes shown big even when they do not have any content.

Each node in the graph when hovered over will have a setting icon pop up at the bottom right edge. When clicked we will have ability to override the content of the node. When clicked on the setting we will be able to choose Content:['Inherit', 'Outline', 'Image'] this will override the content for this node id globally. 

NOTE: the outcome of this is not implementation, first a discussion and then likely multiple tickets and a plan to achieve the objectives.
