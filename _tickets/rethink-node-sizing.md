---
closed_iso: 2026-08-03T23:49:09Z
id: nid_kyowb4v8v51nslbicl4szgcd5_e
title: rethink node sizing
status: closed
deps: []
links: [nid_o5hz7ilcauwe2acqdfh6pcuam_e, nid_cx5zoz7ptucg9nxalibv0mbjb_e, nid_lwionnvohw9k58jw7a2dybht2_e, nid_qjsj5mth2phdqctbm0vfx9elw_e, nid_9hx6okamx3yt0rg9iad2f4151_e]
created_iso: '2026-08-01T01:26:15Z'
status_updated_iso: 2026-08-03T23:49:09Z
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

## Resolution (2026-08-03)

Discussion + plan delivered, implementation split into tickets as requested.

- **Design/discussion doc**: `docs-internal/plan/node-sizing-rethink.md` — problem statement, what the codebase already gives us (pins are the exact docid-keyed global-persistence pattern to reuse; `@xyflow/react` 12 already ships `NodeResizer`, no new dependency; `nodePreviewChoice.ts` is the seam for a per-node content override), recommended design positions, stored-shape sketch (`nodeOverrides` map in `data.json`, version bump, clean break — unpublished).
- **Open decisions for the human** (Q1–Q5: default size driver, central/pinned prominence floor instead of the maxPx bypass, whether overrides may exceed global dials, truncation-ranking independence, silent frontmatter id assignment): written to `.ai_out/_current_decision/current_decision.md` and tracked in decide ticket `nid_o5hz7ilcauwe2acqdfh6pcuam_e` (tag `decide`).
- **Implementation tickets** (dep-ordered, all linked to this one):
  - `nid_cx5zoz7ptucg9nxalibv0mbjb_e` engine: content-aware central/pinned sizing (deps: decide)
  - `nid_lwionnvohw9k58jw7a2dybht2_e` persistence: docid-keyed per-node overrides in data.json (deps: decide)
  - `nid_qjsj5mth2phdqctbm0vfx9elw_e` view: drag-to-resize via NodeResizer (deps: persistence)
  - `nid_9hx6okamx3yt0rg9iad2f4151_e` view: hover gear + Content [Inherit|Outline|Image] override (deps: persistence)

Next step for the human: answer `.ai_out/_current_decision/current_decision.md` (Q1–Q5) into the decide ticket; that unblocks everything else.
