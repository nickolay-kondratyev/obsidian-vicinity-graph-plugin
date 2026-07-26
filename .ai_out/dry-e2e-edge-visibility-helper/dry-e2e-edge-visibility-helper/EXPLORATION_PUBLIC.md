# EXPLORATION_PUBLIC — DRY the duplicated e2e `setAllEdgesVisibility`

Produced by the Explore agent (read-only; TOP_LEVEL_AGENT transcribed it here because that
agent had no write tool). **Findings below are unverified claims — the implementer MUST
re-read the cited files rather than trust line numbers verbatim.**

## 1. The duplication

`e2e/edgeRoutingEval.e2e.ts:165-171` and `e2e/edgeRouting.e2e.ts:109-115` contain
**byte-for-byte identical** free functions:

```ts
async function setAllEdgesVisibility(): Promise<void> {
	await page.evaluate(async (pluginId) => {
		const app = (window as unknown as { app: any }).app;
		const store = app.plugins.plugins[pluginId].pluginDataStore;
		await store.saveGlobalView({ ...store.globalView(), edgeVisibility: "all-edges" });
	}, PLUGIN_ID);
}
```

Each is called once, from `beforeAll` (eval spec ~line 106, routing spec ~line 87).
They close over the module-level `page` + imported `PLUGIN_ID`, which is why they are free
functions rather than harness methods.

## 2. Wider blast radius (context, NOT in scope)

The same `app.plugins.plugins[id].pluginDataStore` shape-knowledge is repeated inline in:

- `e2e/settingsResetReview.e2e.ts` (~53, 61-62, 217, 252, 315)
- `e2e/settingsResetVerify.e2e.ts` (~49, 79)
- `e2e/settingsUxVisual.e2e.ts` (~82-303, heaviest user)

These use `(window as any).app...` rather than the harness idiom. **Out of scope for this
ticket** — do not migrate them. If worth doing, TOP_LEVEL_AGENT files a follow-up ticket.

## 3. Where the shared helper belongs — recommendation

**Add a method to `ObsidianHarness` in `e2e/obsidianHarness.ts`. Do NOT create
`e2e/pluginSettings.ts`.**

Reasoning: the class already owns a cohesive family of "write one global-view field through
the plugin's own persistence API" methods — `setGlobalNodeCap` (~311-320),
`setMaxNodeSizePx` (~328-338), `setNodePreviewPreference` (~349-359), `readGlobalView`
(~366-371). The new helper is a drop-in sibling; a new module would fragment that family for
no isolation benefit. The separate modules that *do* exist (`settingsBaseline.ts`,
`vaultTarget.ts`) earn their own files because they must stay pure (no `obsidian` import —
pulling it into the node-side test process crashes it). An edge-visibility helper inherently
needs `page.evaluate` + the `app` global, i.e. exactly `obsidianHarness.ts`'s concern.

`obsidianHarness.ts` exports: `GlobalViewSnapshot`, `PLUGIN_ID` (= `"vicinity-graph"`, ~line 52),
`OPEN_GRAPH_COMMAND_ID`, and the `ObsidianHarness` class. House style: every
`page.evaluate` callback casts `(window as unknown as { app: any }).app` (never bare
`as any`), with a WHY JSDoc above each method.

## 4. Typing

- `EdgeVisibilityMode = "walked-from-center" | "all-edges"` — `src/engine/types.ts:155`,
  re-exported type-only from the pure barrel `src/engine/index.ts`.
- `ViewSettings.edgeVisibility: EdgeVisibilityMode` — `src/engine/types.ts:296-310`.
- `PluginDataStore.globalView(): ViewSettings` / `saveGlobalView(v: ViewSettings)` —
  `src/persistence/PluginDataStore.ts`.

Type the parameter as `EdgeVisibilityMode` (`import type { EdgeVisibilityMode } from "../src/engine";`),
not the bare `"all-edges"` literal. Precedent for importing engine types into `e2e/` exists
(`settingsBaseline.ts` imports from `../src/view/settingsResetPlan`).

Noted existing inconsistency (do NOT fix, out of scope): `setNodePreviewPreference` hand-repeats
its literal union instead of importing `NodePreviewPreference`.

## 5. Gates

- `npm run check` = `tsc -noEmit && npm run check:e2e`; `check:e2e` = `tsc -noEmit -p e2e/tsconfig.json`.
- `e2e/tsconfig.json` extends root (strict flags apply), `"types": ["node"]`, includes `./**/*.ts`.
- No ESLint config in the repo — `tsc` is the only static gate for `e2e/`.

## 6. Suggested shape (SKETCH — contains a known bug, fix it)

```ts
async setEdgeVisibility(mode: EdgeVisibilityMode): Promise<void> {
	await this.page.evaluate(
		async ({ pluginId, value }) => { /* ... */ },
		{ pluginId: PLUGIN_ID, mode },   // <-- BUG: destructures `value`, passes `mode`
	);
}
```

Then in both specs: delete the local `setAllEdgesVisibility`, replace the call with
`await harness.setEdgeVisibility("all-edges");`, and drop the now-unused `PLUGIN_ID` import
**only if** nothing else in that spec uses it. Verify `harness` is actually in scope at each
call site before assuming it.
