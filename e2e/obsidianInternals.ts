// Type-only, so this whole module is erased at transpile — nothing here loads the
// `obsidian` package (types-only, no runtime) into the node-side test process, and
// the shapes are safe to reference INSIDE `page.evaluate` callbacks (types never
// serialize into the browser).
import type { DepthSettings, NodeContentOverride, NodeExclusionSettings, NodeOverride, ViewSettings } from "../src/engine";

/**
 * The undocumented-but-stable Obsidian `window.app` surface the e2e harness drives,
 * declared ONCE so every `page.evaluate` block that reaches into it is type-checked
 * instead of calling through `any` (which `@typescript-eslint/no-unsafe-call` flags).
 *
 * This is deliberately a NARROW view: only the members the suite actually touches are
 * modelled, each named after the real Obsidian API it stands in for. It is NOT a
 * faithful re-declaration of Obsidian's own types — importing those would drag the
 * `obsidian` runtime into the node-side process (see the module note above). A caller
 * reaching a member not listed here adds it, rather than widening back to `any`.
 *
 * Read it as the FIRST line of a `page.evaluate` block with the single narrowing cast
 * `(window as unknown as { app: E2eObsidianApp }).app`. A module-level helper can't do
 * that job: an evaluate callback is serialized to the browser, so it cannot reference
 * anything from this module's scope — only the (erased) TYPE crosses the boundary.
 */
export interface E2eObsidianApp {
	readonly vault: E2eVault;
	readonly workspace: E2eWorkspace;
	readonly commands: E2eCommands;
	readonly plugins: E2ePlugins;
	readonly setting: E2eSettingManager;
}

/** A file/folder handle — opaque here; it only flows back into the vault methods that produced it. */
export interface E2eAbstractFile {
	readonly path: string;
}

export interface E2eVault {
	getAbstractFileByPath(path: string): E2eAbstractFile | null;
	rename(file: E2eAbstractFile, newPath: string): Promise<void>;
	delete(file: E2eAbstractFile): Promise<void>;
}

/** A split region (`rightSplit` / `rootSplit`) a leaf's root is compared against. */
export interface E2eWorkspaceParent {
	setSize?(size: number): void;
}

/**
 * The `openState` argument to `WorkspaceLeaf.openFile` — only the `eState.subpath`
 * the outline-open path threads through is modelled (the `#heading` an outline
 * click derives), which is exactly what distinguishes a heading-targeted open from
 * a plain node-level one.
 */
export interface E2eOpenState {
	readonly eState?: { readonly subpath?: string };
}

export interface E2eWorkspaceLeaf {
	getRoot(): E2eWorkspaceParent;
	detach(): void;
	openFile(file: E2eAbstractFile, openState?: E2eOpenState): Promise<void>;
}

export interface E2eWorkspace {
	readonly layoutReady: boolean;
	readonly rightSplit: E2eWorkspaceParent;
	readonly rootSplit: E2eWorkspaceParent;
	getActiveFile(): E2eAbstractFile | null;
	/** The heading-targeted open an outline entry makes; reassignable so tests can spy on it. */
	openLinkText(linktext: string, sourcePath: string, newLeaf?: unknown): unknown;
	getLeaf(newLeaf: boolean): E2eWorkspaceLeaf;
	getLeavesOfType(viewType: string): readonly E2eWorkspaceLeaf[];
	iterateAllLeaves(callback: (leaf: E2eWorkspaceLeaf) => void): void;
}

export interface E2eCommands {
	executeCommandById(commandId: string): boolean;
}

export interface E2ePlugins {
	/** docid-keyed by plugin id; the harness only ever asks for the vicinity-graph instance. */
	readonly plugins: Record<string, E2eVicinityPlugin | undefined>;
	setEnable(enabled: boolean): Promise<void>;
	enablePlugin(pluginId: string): Promise<void>;
	disablePlugin(pluginId: string): Promise<void>;
}

/** Change one field of a doc's override — mirrors `NodeOverrideChange` at the two call sites that use it. */
export type E2eNodeOverrideFieldChange =
	| { readonly field: "sizePx"; readonly value: { readonly widthPx: number; readonly heightPx: number } }
	| { readonly field: "content"; readonly value: NodeContentOverride };

/** The `data.json`-backed global store (`pluginDataStore`): dials + the global pinned set. */
export interface E2ePluginDataStore {
	globalView(): ViewSettings;
	globalDepths(): DepthSettings;
	nodeExclusion(): NodeExclusionSettings;
	saveGlobalView(view: ViewSettings): Promise<void>;
	saveGlobalDepths(depths: DepthSettings): Promise<void>;
	saveNodeExclusion(exclusion: NodeExclusionSettings): Promise<void>;
}

/** The per-file `VaultFileStore` (`perDocStore`): per-node overrides + local pins. */
export interface E2ePerDocStore {
	warm(): Promise<void>;
	nodeOverrides(): Readonly<Record<string, NodeOverride>>;
	localPins(mainDocid: string): readonly { docid: string; pinTimestamp: number }[];
	saveNodeOverrideField(docid: string, change: E2eNodeOverrideFieldChange): Promise<void>;
	addLocalPin(mainDocid: string, targetDocid: string, pinTimestamp: number): Promise<void>;
}

export interface E2eVicinityPlugin {
	readonly pluginDataStore: E2ePluginDataStore;
	readonly perDocStore: E2ePerDocStore;
	/** Private in production (ONE fan-out rule); reached by name here — see the harness WHY comment. */
	refreshOpenViews(): void;
}

/** One rendered settings tab (`app.setting.activeTab`). */
export interface E2eSettingTab {
	display(): void;
}

export interface E2eSettingManager {
	readonly activeTab?: E2eSettingTab;
	open(): void;
	openTabById(tabId: string): void;
	close(): void;
}
