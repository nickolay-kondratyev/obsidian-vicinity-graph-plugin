---
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_uykmq7xpow597qs6bpgrhanlt_e
title: "Distinct styling for frontmatter id-ref edges (backlog)"
status: in_progress
deps: [nid_phu0llxhfptse000j66ezrhh3_e]
links: []
created_iso: 2026-08-12T17:19:58Z
status_updated_iso: 2026-08-12T19:03:30Z
type: feature
priority: 4
assignee: nickolaykondratyev
tags: []
---

Backlog follow-up to the frontmatter-id links feature (plan: ticket nid_sjojyvd55emyry45qynphei7o_e). v1 deliberately renders id-ref edges as ordinary `kind: "link"` edges (KISS, human-approved 2026-08-12).

If/when distinct styling is wanted: introduce an id-ref provenance in the edge model (src/engine/types.ts EdgeKind = "link" | "embed" | "both", derived in src/engine/EdgeAssembly.ts from the provider's per-reference LinkKind in src/shared/LinkKind.ts) and give those edges a distinct visual (e.g. dashed) in the view layer, styled via Obsidian theme CSS variables. Requires deciding how a pair with BOTH a wikilink and an id-ref renders. Do not start without confirming the feature earned it.

