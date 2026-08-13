---
closed_iso: 2026-08-13T16:47:02Z
session_ids: [{"a": "claude", "type": "execution", "id": "8c6796a8-d28f-4947-8cdb-de5bb28b6ee9"}, {"a": "claude", "type": "review", "id": "6c3e4110-7416-4192-9ac5-124f52f4604f"}]
working_dir: nickolay-kondratyev_obsidian-vicinity-graph-plugin
id: nid_dit8h888p2ml3092b2zn4zy3u_e
title: "Hierarchy 1: engine descendants-ancestors channels + hierarchy edge relation"
status: closed
deps: [nid_ri1d36t7hmhu0kr652wny1dmz_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T16:47:02Z
type: feature
priority: 3
assignee: nickolaykondratyev
tags: [engine]
---

Engine half of folder-note hierarchy. Full spec in body.


Design record: ticket `nid_ri1d36t7hmhu0kr652wny1dmz_e` (closed PLAN) — read it first.

## Scope (pure engine + shared; no obsidian imports — importGuard enforces)

1. **Shared folder-note rule** — ONE pure module in `src/shared/` (e.g.
   `FolderNotes.ts`): given a set/lookup of vault paths, resolve
   folder -> folder note (inside `X/X.md` beats sibling `X.md`; `.md` beats
   `.canvas`; md+canvas only) and note -> owned folder. Tests colocated.
2. **Seam**: `src/engine/LinkProvider.ts` gains `getChildNotes(path): readonly VaultPath[]`
   and `getParentNote(path): VaultPath | undefined` (facts, not decisions).
   Extend `src/engine/FakeLinkProvider.ts` with fixture wiring.
3. **Channels**: `src/engine/types.ts` — `Channel` gains `"descendants" | "ancestors"`;
   `CHANNEL_DEPTH_FIELD`, `ChannelDepths`, `CHANNEL_LINKER` (in VicinityTraversal.ts)
   entries; `DepthSettings` per role gains `descendantDepth` + `ancestorDepth`.
   Follow the compiler — the Record<Channel,...> exhaustiveness guards name every site.
4. **Traversal**: `src/engine/VicinityTraversal.ts` `neighborsOf` cases calling the
   new seam methods. Hierarchy edge orientation: parent is ALWAYS the edge source
   (both channels emit parent -> child).
5. **Edge relation set**: `src/engine/EdgeAssembly.ts` — an ordered-pair edge carries
   link occurrences AND/OR the folder relation (today's `EdgeKind` grows a hierarchy
   dimension; exact shape is implementer's call, but a MERGED pair must be ONE edge
   and pure-hierarchy must be distinguishable for the view). Hierarchy relations are
   invisible to `getLinkCount` and the cross-links sweep.
6. **Settings spec**: `src/engine/SettingsSpec.ts` — 4 new bounded leaves
   (descendant/ancestor depth x MAIN/pinned), defaults MAIN 1/1, pinned 0/0, same
   bounds family as existing depth leaves. Update the id-keyed table in
   `src/engine/settingsProductDefaults.test.ts` (the ONE sanctioned literal spot).
   `src/persistence/persistedShapes.ts` parse: clean break, no migration (pre-publish).
7. **Truncation tie-break is NOT here** — split into Hierarchy 1b
   (`nid_k4q36qb0nvmusoygl56trgtz2_e`); this ticket leaves the truncation chain
   untouched (hierarchy-discovered nodes already participate via their depth tags).

## Required fixture tests (BDD, FakeLinkProvider)

- The named Jon scenario, all three budget combinations (see plan ticket).
- Descendants depth 2 reaches a grandchild ONLY through an intermediate folder note;
  a folder without a folder note is not bridged.
- Ancestors chain stops at the first folder-note gap.
- `Jon.md` + `Jon/Jon.md` both present: inside wins, sibling is an ordinary note.
- `.canvas` folder note and `.canvas` child both participate; folder note is not
  its own child; kind-purity (a descendant's own wikilinks are NOT expanded).

Note: `src/view/settingsRowSpecCoverage.test.ts` will fail on the 4 new spec leaves
until Hierarchy 3 declares their rows — if landing this ticket standalone, use the
allowlist WITH a written reason pointing at `nid_i3cznjkcnelqzvhp0gqlis499_e`.

## Notes

**2026-08-13T16:47:02Z**

RESOLVED — implemented & green (npm test: 1936 passed; npm run check: 0 errors).

All 7 scope items done:
1. src/shared/FolderNotes.ts (pure, + FolderNotes.test.ts): precedence inside X/X.md > X/X.canvas > X.md > X.canvas; folderNoteOf / childNotesOf / parentNoteOf.
2. LinkProvider.getChildNotes / getParentNote; FakeLinkProvider delegates to FolderNotes.fromPaths(files). ObsidianLinkProvider STUBBED (returns empty/undefined) with docs pointing at Hierarchy 2 nid_bw8hltfj3nsyas03mpfmqn7mg_e — transparent documented gap, not silent.
3. types.ts: Channel += descendants|ancestors; CHANNELS, CHANNEL_DEPTH_FIELD, ChannelDepths(descendantDepth/ancestorDepth), DepthSettings(pinnedDescendantDepth/pinnedAncestorDepth), DepthSettingsFacts updated. Added ChannelRelation + CHANNEL_RELATION Record, and directedLinkKey(source,target) (NUL-separated).
4. VicinityTraversal: CHANNEL_LINKER += descendants:current, ancestors:neighbor; neighborsOf cases; parent ALWAYS edge source. TraversalResult exposes hierarchyPairKeys + linkPairKeys.
5. EdgeAssembly: GraphEdge gained hierarchy:boolean (chose a boolean over growing EdgeKind union to avoid view churn). Pure-hierarchy = count 0; merged = ONE edge. Design fix: pure-vs-merged tracked via linkPairKeys (pairs a LINK channel walked), NOT getLinkCount — the Jon links-out=0/descendants=1 case has a real link but must render PURE. hasLink = walkedLink || (crossLinksOn && linkCount>0).
6. SettingsSpec: 4 bounded leaves (default MAIN 1/1, pinned 0/0); settingsProductDefaults.test.ts id-table updated; persistedShapes parse (clean break). settingsRowSpecCoverage.test.ts allowlist REACHABLE_LATER with reason pointing at Hierarchy 3 nid_i3cznjkcnelqzvhp0gqlis499_e.
7. Truncation chain untouched (1b nid_k4q36qb0nvmusoygl56trgtz2_e).

Required fixture tests all present in src/engine/hierarchyChannels.test.ts (Jon 3 combos + crossLinks, grandchild via intermediate, ancestor gap, both-present inside-wins, canvas + kind-purity, hierarchy invisibility).

Assumption/decision: childNotesOf = direct node-bearing files in the owned folder only. An inside-style subfolder folder note is thus NOT descendant-reachable from a grandparent (asymmetric with ancestors, which walks inside-style up). Matches all required tests; documented for Hierarchy follow-ups.

Pure engine/shared/persistence change — stayed on npm test per CLAUDE.md (no rendered behavior; adapter stubs are inert).
