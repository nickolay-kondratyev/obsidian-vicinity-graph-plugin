# EXPLORATION — step-06-controls (index)

Task: implement [[docs-internal/plan/steps/step-06-controls.md]] — in-view toolbar (per-central per-direction depth steppers, pin/unpin, expandable sizing section, node cap), reset-to-global affordances, node pin/unpin, and a global `PluginSettingTab`.

## Detailed findings (read as needed)
| File | Scope |
|------|-------|
| `EXPLORATION_VIEW.md` | UI/view/plugin-wiring: main.ts, NeighborhoodGraphView, GraphViewController, NeighborhoodGraphFlow, reusable menu/button patterns, CSS conventions, integration gaps. |
| `EXPLORATION_PERSISTENCE.md` | Persistence & settings-write layer: DocData/PluginData shapes, centralDepths, DocDataMutations, PersistenceServices, ensureDocId, resolvers, defaults. |
| `EXPLORATION_ENGINE_PLAN.md` | Engine + plan/requirements: goals 3&4, depth/sizing/cap types, depth-0 semantics, the MAIN-switch scenario, what's already built, test conventions, open items. |

## Headline conclusions
1. **Step-06 is almost entirely UI.** Every write primitive (`PersistenceServices.pinDoc/unpinDoc/setDocDepthField/setDocViewField/setCentralDepthField`, `PluginDataStore.saveGlobalDepths/saveGlobalView/addPin/removePins`) and the read/assembly/resolve plumbing are built and tested in steps 02–03. No new engine algorithm implied.
2. **Greenfield UI**: no `PluginSettingTab`, no toolbar, no node pin/unpin affordance, no "inherited-vs-pinned" display derivation exist today.
3. **Key integration gaps**: (a) `NeighborhoodGraphView`/`main.ts` must plumb `pluginDataStore`+`persistenceServices` into the view; (b) `GraphViewController` needs a "settings changed → rebuild now" entry point (none today); (c) reuse `<Panel>` (xyflow) for toolbar, `AttachmentChip` hover-button + `ObsidianGraphUi.showAttachmentMenu` native-`Menu` for pin/unpin; (d) never edit generated `styles.css` — edit `graph-view.css`, all colors from Obsidian theme vars.
4. **Reset-to-global = write field with `value=undefined`** (deletes field → resolver falls through to global). No separate reset API needed.
5. **"Can't be pinned" case**: `PersistenceServices` methods return `PersistableIdentity`; branch on `kind==="not-persistable"` → show Obsidian `Notice`.
6. **Depth 0 = central only** (no expansion that direction). No max-depth constant exists — needs a decision + new named constant.

## Genuine gap to design
No function derives "is this central's depth field inherited or pinned" for the visual distinction — engine returns resolved `depthTags`, not override-presence. Either expose per-central override-presence from the adapter, or add a small view-layer pure fn diffing loaded `DocData` against resolved settings. This is contract-heavy → unit-test target.

## Decisions needing human input (→ CLARIFICATION)
- Toolbar placement/overflow behavior at ~300px sidebar width.
- Max depth-stepper bound (numeric + new constant).
- Unpin-node affordance placement: hover button vs right-click menu vs both.
- Node-cap control presentation: MAIN-view-only vs cascade-aware.
