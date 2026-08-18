// Type-only, so this whole module is erased at transpile — nothing here loads the
// `obsidian` package (types-only, no runtime) into the node-side test process, and
// the shapes are safe to reference INSIDE `page.evaluate` callbacks (types never
// serialize into the browser).
import type {
	DepthSettings,
	FrontmatterLinkSettings,
	NodeContentOverride,
	NodeExclusionSettings,
	NodeOverride,
	ViewSettings,
} from "../src/engine";

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
	readonly metadataCache: E2eMetadataCache;
}

/** A file/folder handle — opaque here; it only flows back into the vault methods that produced it. */
export interface E2eAbstractFile {
	readonly path: string;
}

/**
 * One parsed reference the provenance spec reads out of a file cache — the NARROW slice
 * of Obsidian's `Reference` the suite asserts on (its target `link` and the raw `original`
 * text whose `!` prefix distinguishes an embed). `original` is documented "Not available on
 * Publish", so it is optional here — the desktop spec measures whether it is populated.
 */
export interface E2eReference {
	readonly link: string;
	readonly original?: string;
}

/**
 * The subset of Obsidian's `CachedMetadata` the provenance spec reads: the three
 * reference arrays LinkKind routing depends on. Each is optional — core omits an array
 * entirely when a file carries none of that reference shape.
 */
export interface E2eCachedMetadata {
	readonly links?: readonly E2eReference[];
	readonly embeds?: readonly E2eReference[];
	readonly frontmatterLinks?: readonly E2eReference[];
}

export interface E2eMetadataCache {
	getFileCache(file: E2eAbstractFile): E2eCachedMetadata | null;
	/**
	 * Core's link index: source path → (resolved destination path → count). The
	 * canvas-indexing spec probes whether a canvas landed here yet. Indexing at
	 * `resolvedLinks[path]` yields `... | undefined` (a not-yet-indexed source).
	 */
	readonly resolvedLinks: Record<string, Record<string, number>>;
	/** The resolver seam the link fallback rides — a linkpath + source path → the destination file, or null. */
	getFirstLinkpathDest(linkpath: string, sourcePath: string): E2eAbstractFile | null;
}

export interface E2eVault {
	getAbstractFileByPath(path: string): E2eAbstractFile | null;
	rename(file: E2eAbstractFile, newPath: string): Promise<void>;
	delete(file: E2eAbstractFile): Promise<void>;
	read(file: E2eAbstractFile): Promise<string>;
	modify(file: E2eAbstractFile, data: string): Promise<void>;
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

/** One node on an open canvas — opaque but for its `id`, which the deletion spec round-trips. */
export interface E2eCanvasNode {
	readonly id: string;
}

/** The `createTextNode` argument the canvas specs drive (matches the canvas view's own API). */
export interface E2eCanvasTextNodeOptions {
	readonly pos: { readonly x: number; readonly y: number };
	readonly size: { readonly width: number; readonly height: number };
	readonly text: string;
	readonly focus: boolean;
	readonly save: boolean;
}

/** The canvas controller (`leaf.view.canvas`) the editing specs create/select/delete nodes through. */
export interface E2eCanvas {
	readonly nodes: ReadonlyMap<string, E2eCanvasNode>;
	/** The focusable canvas root — keyboard focus is moved here, OUT of any card iframe. */
	readonly wrapperEl: { focus(): void };
	createTextNode(options: E2eCanvasTextNodeOptions): E2eCanvasNode;
	selectOnly(node: E2eCanvasNode): void;
}

/** The canvas view mounted in a `"canvas"` leaf — the only `leaf.view` shape the suite reaches. */
export interface E2eCanvasLeafView {
	readonly canvas: E2eCanvas;
}

export interface E2eWorkspaceLeaf {
	getRoot(): E2eWorkspaceParent;
	detach(): void;
	openFile(file: E2eAbstractFile, openState?: E2eOpenState): Promise<void>;
	/** Narrowed to the canvas view — the suite only reaches `.view` off `getLeavesOfType("canvas")`. */
	readonly view: E2eCanvasLeafView;
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
	frontmatterLinks(): FrontmatterLinkSettings;
	saveGlobalView(view: ViewSettings): Promise<void>;
	saveGlobalDepths(depths: DepthSettings): Promise<void>;
	saveNodeExclusion(exclusion: NodeExclusionSettings): Promise<void>;
	saveFrontmatterLinks(frontmatterLinks: FrontmatterLinkSettings): Promise<void>;
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
