# EXPLORATION_PUBLIC — step-05-rich-rendering (branch: main)

Index + key conclusions. Details in the three exploration files (same dir):

| File | Covers |
|---|---|
| `EXPLORATION_view.md` | View/rendering layer: view shell, React Flow (`@xyflow/react` ^12.11.2), flow/elk mappings, styling, interaction handling, per-feature modification map. |
| `EXPLORATION_engine_data.md` | Engine/data model, adapter, persistence, edge direction/dedup, resource-path seam, test setup, **GAPS FOR STEP 05** list. |
| `EXPLORATION_conventions_history.md` | Plan boundaries (05 vs 06 vs 07), binding step-04 decisions, testing conventions, build/dev workflow, changelog convention, tickets. |

## Top-line conclusions

1. **Engine already computes nearly all node data step 05 needs** (`GraphNode`: title, folder, attachments+isImage, firstImagePath, sizeScore/sizePx, isCentral/isMain, minDepth; `NeighborhoodGraph.hiddenNodeCountsByFolder`, `viewSettings.groupByFolder`). The **view passthrough is lossy**: `FlowNodeData` keeps only 5 fields, `FlowSnapshot` drops hidden counts + viewSettings → must widen (view-side only).
2. **Two genuine engine gaps:**
   - Per-edge link **count** — `EdgeAccumulator` collapses duplicate links per ordered pair and discards multiplicity; `GraphEdge` has no count field. Needed for "count badge".
   - No **resource-URL seam** — nothing resolves `VaultPath` → displayable URL; add port method (`vault.getResourcePath` at Obsidian boundary).
3. **Compound layout is pre-wired**: `elk.hierarchyHandling=INCLUDE_CHILDREN` already set; `extractElkPositions` already accumulates parent offsets. Folder groups = supply container nodes + `parentId` in `elkMapping`/`flowMapping`; no elk-runner rework.
4. **Edges are directed** in the model (linker→linked, A→B and B→A distinct). Custom edge component + `markerEnd` + offset-curvature is view work; RF `nodeTypes`/`edgeTypes` currently unused.
5. **Tiers**: MAIN = `isMain`; pinned central = `isCentral && !isMain`; regular otherwise. No engine change needed.
6. **Hexagonal conventions binding**: RF imports only in `NeighborhoodGraphFlow.tsx` (+ new components); pure mappings stay RF-free and node-tested; Obsidian APIs behind ports (`viewPorts.ts`); edit `src/view/graph-view.css` only (`styles.css` is generated); use `graphIdentity.ts` shared ids.
7. **Interactions gap**: no ctrl/cmd-click, no hover-link, single-arg `openNote` (main-area leaf). Extend `NoteNavigatorPort` + `ObsidianNoteNavigator`.
8. **Testing**: BDD vitest for pure transforms (folder-color hash, edge collapse/pairing, 2+ group rule, attachment→icon-strip); never mount RF in tests; dev-vault (`npm run setup:dev-vault`) is the manual/visual harness (note1 embeds pic.png = thumbnail fixture). Baseline green: 335 tests / check / build.
9. **Boundaries**: pin *styling* here, pin *affordance* in step 06; `getState`/`setState` no-ops are step-06 anchors — leave alone; single-instance view is accepted V1.
