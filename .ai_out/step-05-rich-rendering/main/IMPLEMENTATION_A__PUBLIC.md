# IMPLEMENTATION_A__PUBLIC — step-05 Phase A (data model & pure logic)

Status: **DONE**. Gates green. No `#QUESTION_FOR_HUMAN`. Commits `a4ab397`, `680ebd3`, `ef6cec1`, `6a4667a` (branch main).

## Gate results (exact)
- `npm test`: **422 passed / 39 files** (main) + **69 passed / 6 files** (sublib). Baseline was 335 → +87 new tests, zero removed/weakened (two shape-only assertion updates, listed below).
- `npm run check` (tsc -noEmit): exit 0.
- `npm run build`: exit 0 — `main.js` 1,840,411 B, `styles.css` 19,176 B.

## What shipped (files + why)

### Engine — per-edge link count (CLARIFICATION Q1)
- `src/engine/types.ts` — NEW `DirectedLink {source, target}` (count-free pair for intermediate stages); `GraphEdge extends DirectedLink { count: number }` (>= 1).
- `src/engine/LinkProvider.ts` — NEW `getLinkCount(source, target): number` on the seam; link lists documented as deduplicated. `FileMetadata` gains `frontmatterTitle?: string`.
- `src/engine/EdgeVisibility.ts` — the ONE place counts attach, for BOTH modes (`walked-from-center` and `all-edges`). Floors at 1 only when the provider answers 0 for an edge that was demonstrably walked (cache lag) — documented defensive floor, not fabrication.
- `src/engine/EdgeAccumulator.ts`, `NeighborhoodTraversal.ts`, `GraphTruncator.ts` — intermediate edges retyped `DirectedLink`.
- `src/adapters/ObsidianLinkProvider.ts` — `getLinkCount` from `metadataCache.resolvedLinks[source][target]` (Obsidian's own count); canvas-fallback mode counts occurrences in the parsed node list.
- `src/engine/FakeLinkProvider.ts` — fixtures may now declare duplicate links; `getOutgoingLinks`/`getIncomingLinks`/attachments are DEDUPLICATED (real-adapter parity), `getLinkCount` counts raw occurrences.

**ROOT-CAUSE note**: multiplicity is provider knowledge only. `getOutgoingLinks` dedups and incoming lists are per-source, so the traversal streams can never see multiplicity; and multi-root BFS revisits pairs, so counting in the accumulator would over-count. Both visibility modes get honest counts from the provider.

### Title from frontmatter (human-added requirement)
- `src/adapters/obsidianPorts.ts` — `CachedMetadataPort.frontmatter?: Readonly<Record<string, unknown>>`.
- `src/adapters/ObsidianLinkProvider.ts` — precedence `title` > `name`, markdown only, non-empty strings only (numbers/lists skipped → fall through); surfaces as `FileMetadata.frontmatterTitle`.
- `src/engine/NeighborhoodTraversal.ts` — `title = frontmatterTitle ?? basename`.
- `FakeLinkProvider` fixture: `FakeFileSpec.frontmatterTitle?: string`.

### New pure view modules (all RF-free, node-tested)
- `src/view/folderGrouping.ts` — `deriveFolderGroups(nodes, groupByFolder)` → `{ groups: FolderGroup[], groupFolderByMemberPath }`. 2+ rule; **vault root ("") never groups**; deterministic first-seen order. `MIN_GROUP_MEMBER_COUNT = 2`.
- `src/view/attachmentIconStrip.ts` — `attachmentIconStrip(attachments)` → `AttachmentIconGroup { extension, count, paths }[]`, first-seen extension order, extensions lower-cased via `VaultPathFacts.extensionOf`.
- `src/view/truncationBadges.ts` — `deriveTruncationBadges(hiddenCountsByFolder, renderedGroupFolders)` → `{ hiddenCountByGroupFolder, orphan: OrphanTruncation }`. `OrphanTruncation { totalHiddenCount, breakdown: {folder, hiddenCount}[] }` (breakdown sorted by folder path); `NO_ORPHAN_TRUNCATION` shared zero constant.
- `src/view/graphIdentity.ts` — `folderGroupIdOf(folder)` = `"folder-group:" + folder`, `isFolderGroupId(id)`.
- `src/shared/VaultPathFacts.ts` — `folderNameOf(folderPath)` (last segment).

### Widened mappings / snapshot (EXACT shapes Phase B consumes)
`src/view/flowMapping.ts`:
```ts
type NodeTier = "main" | "pinned-central" | "regular";

interface FlowNodeData {
  path: string; title: string;
  tier: NodeTier;                    // REPLACES isCentral/isMain (see breaking note)
  sizePx: number; sizeScore: number;
  folder: string;                    // "" = vault root
  breadcrumbFolder?: string;         // folder NAME, ONLY on ungrouped non-root nodes
  firstImagePath?: string;           // vault path; Phase B resolves to URL via new port
  imageCount: number;                // "+N more" thumbnail badge = imageCount - 1
  attachmentGroups: readonly AttachmentIconGroup[];
}
interface FlowGroupData { folder: string; folderName: string; hiddenCount: number }  // hiddenCount 0 = no badge

type FlowNode = NoteFlowNode | GroupFlowNode;   // discriminant: kind: "note" | "folder-group"
// both: { id, position, width, height, parentId? } — parentId set on grouped members;
// position is RF-ready: parent-RELATIVE when parentId present, absolute otherwise.
// Group nodes are emitted BEFORE their children (RF parent-first rule).

interface FlowEdge { id; source; target; count: number; hasOpposite: boolean }
interface FlowGraph { nodes; edges; groupByFolder: boolean; orphanTruncation: OrphanTruncation }
```
`src/view/GraphViewController.ts` — `FlowSnapshot` now `{ status, nodes, edges, groupByFolder, orphanTruncation }`; controller stores elk group dimensions alongside positions and replays both on the reuse-layout path; `openNode` ignores `folder-group:` ids.

`src/view/elkMapping.ts` — compound: folder containers (`folderGroupIdOf` ids) nest member leaves; intra-group edges relocate onto the container (elk closest-common-ancestor rule), cross-boundary edges stay on root; `extractElkPositions` unchanged (absolute, nesting verified by test); NEW `extractElkDimensionsById` for elk-computed group sizes → `withGroupDimensions` (flowMapping) applies them to group nodes ONLY (note sizes stay engine truth).

`src/view/GraphStructureDiff.ts` — `groupByFolder` flip now forces relayout (preserved positions would lack group entries and misplace parent-relative children).

`src/view/NeighborhoodGraphFlow.tsx` — minimal union handling only: `kind: "folder-group"` → RF `type: "group"` placeholder box with `parentId` threading; note nodes render `data.label` as before. **Live wiring is ON** (not gated): groups render as plain RF containers until Phase B — rough but functional, step-04 behavior intact (all controller tests green).

## Decisions Phase B/C MUST know
1. **`tier` replaces `isCentral`/`isMain` in `FlowNodeData`** — components must switch on `tier` (`"pinned-central"` = isCentral && !isMain). DRY: no flag pair to re-derive.
2. **Group id namespace** `"folder-group:" + folderPath`; use `isFolderGroupId` before treating a node id as a vault path. Documented improbable-collision trade-off in `graphIdentity.ts`.
3. **Positions**: group members carry parent-RELATIVE positions (RF subflow convention); conversion lives in `withPositions`. Positions stored in the controller stay ABSOLUTE.
4. **Orphan aggregate is a superset of "zero visible members"**: every hidden count whose folder has NO rendered group (fully truncated folders, singleton folders, vault root) flows into the corner overlay — so nothing silently disappears (Q4's mandate). Breakdown folders are full paths; Phase B formats them (root = "").
5. **Root folder never groups and never breadcrumbs** (no folder identity to show).
6. **hasOpposite instead of an offset sign**: if both edges of an A↔B pair curve to the same side of their OWN travel direction, the curves mirror automatically.
7. elk containers currently get no extra `elk.padding` — Phase B will likely want top padding for the group label (add a layoutOption on containers in `elkMapping.ts`, one-liner).
8. `GroupFlowNode.width/height` are 0 pre-layout (`UNSIZED_GROUP_PX`) and elk-sized after; fake layouts that don't size containers leave 0 — harmless in tests.

## Existing-test changes (transparency)
- `EdgeVisibility.test.ts` "same link twice → deduplicated": expectation gains `count: 2` (same dedup behavior, richer shape).
- `flowMapping.test.ts` data-shape assertion updated to the new payload (tier etc.). No behavior test deleted or skipped.

## Rejected alternatives
- Counting multiplicity in `EdgeAccumulator`/traversal — over-counts across roots/directions and incoming lists hide duplicates; provider is the only honest source.
- Optional `count?` on `GraphEdge` — weaker contract; instead split `DirectedLink` (intermediate) vs `GraphEdge` (output, required count).
- Keeping `isCentral`/`isMain` alongside `tier` — knowledge duplication.
- Gating group emission off — live wiring proved safe under the controller test suite; gating would have pushed integration risk into Phase B.

## Iteration 1 — review-feedback pass (2026-07-18)

Addressed IMPLEMENTATION_REVIEW_A__PUBLIC.md findings (verdict READY, 3 MINOR + 2 NIT).

| Finding | Disposition | Detail |
|---------|-------------|--------|
| MINOR-1 untrimmed frontmatter title | **FIXED** | Failing test first (`WHEN the title has surrounding whitespace THEN it is trimmed`), then `return value.trim();` in `ObsidianLinkProvider.frontmatterTitleOf` with a WHY comment. `src/adapters/ObsidianLinkProvider.ts`, `.test.ts`. |
| MINOR-2 implicit dual `deriveFolderGroups` contract | **FIXED** | Took the reviewer's cheapest option: CONTRACT doc-comment on `deriveFolderGroups` naming both consumers (`elkMapping`, `flowMapping`) and the purity/determinism requirement, plus the failure mode (desynchronized parentIds vs layout). No signature change — deriving once in the controller was rejected as not worth the churn for a today-correct pure function (Pareto). `src/view/folderGrouping.ts`. |
| MINOR-3 no step-05 dev-vault fixtures | **FIXED** | Extended `scripts/setup-dev-vault.sh` idempotently (same `write_if_missing` pattern; new notes link TO note1 so existing note1.md never needs rewriting): `projects/alpha.md` + `projects/beta.md` (2+ folder group, alpha↔beta bidirectional, alpha→note1 duplicated link → count 2, frontmatter title, png/pdf/csv attachment strip), `solo/gamma.md` (singleton folder, whitespace-padded frontmatter title exercising the trim fix), `assets/data.csv`, `assets/report.pdf` (minimal valid PDF). Smoke-run notes appended to the script's closing banner. Verified: run 1 creates 5, run 2 = 13 keep / 0 create, build OK both times. |
| NIT-1 `extension: ""` icon-strip group label | **REJECTED (deferred)** | Rendering concern with no Phase A surface — the label for the extension-less group is a Phase B component decision. Already documented on the `AttachmentIconGroup` interface and flagged in the review for Phase B's plate; nothing actionable here without writing Phase B UI code (out of scope). |
| NIT-2 `count` duplicates `paths.length` | **REJECTED** | Deliberate renderer-ergonomics denormalization in a read-only payload built in one place; reviewer himself judged it "fine to keep". Removing it would trade a trivial field for `.paths.length` noise at every badge call site — no knowledge-duplication risk since both come from the same single construction site. |

### Iteration 1 gate results
- `npm test`: **423 passed / 39 files** (main, +1 trim test) + **69 passed / 6 files** (sublib) — exit 0.
- `npm run check` (tsc -noEmit): exit 0.
- `npm run build`: exit 0.
- `scripts/setup-dev-vault.sh`: `bash -n` clean; double-run idempotency verified.

No `#QUESTION_FOR_HUMAN` items.

## Punted (deliberately, per phase plan)
- Resource-URL port (`vault.getResourcePath`), ctrl/cmd-click, hover-link, Obsidian `Menu`, all styling/CSS and custom node/edge components → **Phase B**.
- Playwright harness → **Phase C**.
- Live visual confirmation in Obsidian is not possible in this environment; correctness rests on the unit/integration suites + real-elk compound layout tests. Human smoke run happens after Phase B per step-04 pattern.
