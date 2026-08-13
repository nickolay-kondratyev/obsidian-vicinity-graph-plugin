---
id: nid_dit8h888p2ml3092b2zn4zy3u_e
title: "Hierarchy 1: engine descendants-ancestors channels + hierarchy edge relation"
status: open
deps: [nid_ri1d36t7hmhu0kr652wny1dmz_e]
links: [nid_ri1d36t7hmhu0kr652wny1dmz_e, nid_bw8hltfj3nsyas03mpfmqn7mg_e, nid_i3cznjkcnelqzvhp0gqlis499_e, nid_f5bfjoymr2pt7odxieunkxasd_e, nid_eymj85m7qccbpkoo4qj6b1q6t_e, nid_uxugk82jeu4cfj5ujyk4l79e7_e]
created_iso: 2026-08-13T15:35:42Z
status_updated_iso: 2026-08-13T15:35:42Z
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
