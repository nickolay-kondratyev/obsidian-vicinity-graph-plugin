---
id: nid_mr42m1k8cmyeusemmvmxuuaxb_e
title: "Tag facts: per-note tags from Obsidian reach the engine and GraphNode"
status: open
deps: []
links: []
created_iso: 2026-11-17T20:32:45Z
status_updated_iso: 2026-11-17T20:32:45Z
type: task
priority: 1
assignee: CC_WITH-nickolaykondratyev
tags: [tags-v1]
parent: nid_xhed75cwiy0ui4fokv6l02cxf_e
---

## Goal
Every rendered note knows its tags. This is the shared foundation for tag grouping (`nid_86c83wvlt5tbfs6s9ttr8r7mq_e`) and the tag-filtered mode (`nid_aimlia0wjp0ms0uzd4fvhbomo_e`). Small but it unblocks two parallel lanes.

Part of epic `nid_xhed75cwiy0ui4fokv6l02cxf_e`; decisions in `_agent_decisions/needs_review/tags-v1-product-decisions.md`.

## Done criteria
- A branded tag type and ONE pure shared module (e.g. `src/shared/Tags.ts`) owning the tag rules: normalisation (case-insensitive identity, `#` stripped, display casing preserved), nested-tag ancestor expansion (`project/alpha` ⇒ also `project`), and "is tag X equal to or nested under Y" (Obsidian's own tag-search semantics). Unit-tested, BDD style.
- `LinkProvider` (`src/engine/LinkProvider.ts`) reports a note's tags as a FACT (body hashtags + frontmatter `tags`/`tag`, as Obsidian's `getAllTags` sees them); `ObsidianLinkProvider` implements it from the metadata cache (no file reads) via the `MetadataCachePort` seam; `FakeLinkProvider` and `src/adapters/FakeObsidianPorts.ts` support it.
- `GraphNode` (`src/engine/types.ts`) carries the note's tags (canvas and other non-markdown files: empty). Existing engine tests still pass.
- `npm run check` and `npm test` green.

## Context
- Engine purity: `src/engine/` and `src/shared/` must not import `obsidian` (guard: `src/engine/importGuard.test.ts`).
- Adapter today: `src/adapters/ObsidianLinkProvider.ts` uses `metadataCache.getFileCache`; no tag reads exist anywhere yet.
- Rebuild triggers: metadata `resolved` already rebuilds the view (`src/view/VicinityGraphView.tsx:154-163`), so a tag edit reaches the graph without new wiring — verify, don't assume.

## Constraints
- Store tags as reported (deduped, normalised identity); do NOT pre-expand ancestors onto `GraphNode` — expansion is a rule consumers call from the shared module, so the rule lives once.

## Non-goals
- No grouping, no UI, no vault-wide "which notes have tag X" query (the tag-filter ticket owns that).
