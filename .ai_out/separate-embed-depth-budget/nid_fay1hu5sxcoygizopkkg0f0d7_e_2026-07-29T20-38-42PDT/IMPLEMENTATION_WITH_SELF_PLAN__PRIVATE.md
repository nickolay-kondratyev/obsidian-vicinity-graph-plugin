# Stage 1 — carry `LinkKind` (rehydration memory)

## Goal
Tag OUTGOING references with `LinkKind = "link" | "embed"`, always-parse canvases,
ZERO behavior change. Nothing consumes the kind yet.

## Plan (checklist)
1. [ ] `src/shared/LinkKind.ts` — `LINK_KINDS`, `LinkKind`, `LinkKinds.ofEmbedMarker`,
       `HarvestedLink`. In `shared/`, NOT `engine/`, because the two shared regex
       matchers must name the kind and `shared` must never import `engine`
       (engine → shared already exists). Re-exported from `src/engine/index.ts`
       so the engine remains the public owner of the domain type.
2. [ ] `Wikilinks` / `MarkdownInlineLinks`: `(!?)` becomes capture group 1, the old
       group 1 shifts to group 2. `linkTargetsOf` → `harvestedLinksOf` returning
       `HarvestedLink[]`. `src/view/outlineEntryLabel.ts` replace-callback must gain
       the extra positional arg (silent-shift hazard — it has tests).
3. [ ] `ReferenceOrder`: `OrderedReference.kind`; `cache.embeds` ⇒ embed,
       `cache.links` ⇒ link, `frontmatterLinks` ⇒ link. + `original` cross-check test.
4. [ ] `CanvasFallbackParser.CanvasReference`: add `linkKind` (the existing `kind`
       stays the RESOLUTION mechanism). file-node ⇒ embed; text-node ⇒ harvested kind.
5. [ ] Engine port: `OutgoingReference {target, kind}`, `getOutgoingReferences(path)`,
       `OutgoingReferences.targetsOf(refs)`. `getOutgoingLinks` KEPT as the kind-blind
       view, derived via `targetsOf` (so ~28 existing behavior assertions stay untouched
       and prove zero behavior change). `getLinkCount` unchanged — see PUBLIC.md.
6. [ ] `FakeLinkProvider`: new `embeds?` fixture map (links first, then embeds per source).
7. [ ] `ObsidianLinkProvider`: `getOutgoingReferences`; DELETE the core-indexed skip in
       `create` (3a); delete now-dead `CanvasCapability.ts` + test; rename
       `fallbackServedCanvasPaths` → `parsedCanvasPaths`; update `main.ts` debug log.
8. [ ] Tests + `npm test` + `npm run check` green. Commit as you go.

## Landmines found during exploration
- `src/view/outlineEntryLabel.ts:44` uses `Wikilinks.globalPattern()` in a
  `String.replace` callback reading group 1 — adding a leading capture SILENTLY
  shifts it. Must update, tests cover display output.
- `ObsidianLinkProvider.test.ts` "WHEN an indexed canvas has no links at all THEN its
  empty index entry is respected" (was ~:175) is the ONE test that genuinely encodes the
  deleted core-indexed regime (content has a file node, `resolvedLinks: {"a.canvas": {}}`).
  It must be REPLACED by an always-parse contract test, not weakened.
- Every other core-indexed/fallback parity pair stays green under always-parse
  (verified by reading each fixture: contents and `resolvedLinks` agree).
- `getLinkCount` for markdown reads `resolvedLinks`, which MERGES link+embed counts.
  A per-kind split would have to re-derive totals from the file cache ⇒ totals could
  change ⇒ behavior change. Left kind-blind deliberately.
