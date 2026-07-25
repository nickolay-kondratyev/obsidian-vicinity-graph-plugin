import type { ElkNode } from "elkjs";
import type { ForceLayoutSettings, VicinityGraph } from "../engine";
import type { ControlsModel } from "./ControlsModel";
import type { SettingsCommand } from "./settingsWritePlan";

/**
 * Narrow structural ports the {@link GraphViewController} depends on (DIP).
 * Types only — no runtime import — so the controller has ZERO obsidian / elkjs /
 * builder runtime coupling and is fully node-testable with plain fakes (no
 * obsidian runtime mock). Real collaborators satisfy these structurally:
 * `VicinityGraphBuilder` → {@link GraphSourcePort}, `ElkLayoutRunner` →
 * {@link GraphLayoutPort}, `ObsidianNoteNavigator` → {@link NoteNavigatorPort}.
 */

/**
 * One rebuild's output: the graph the engine produced AND the toolbar's
 * read-model, both derived from the SAME loaded inputs (single disk read) so
 * the value shown next to a stepper is structurally the value the graph used.
 */
export interface GraphBuildResult {
	readonly graph: VicinityGraph;
	readonly controls: ControlsModel;
}

/** Builds the vicinity graph for a MAIN file path. `null` = path unresolved. */
export interface GraphSourcePort {
	build(mainPath: string): Promise<GraphBuildResult | null>;
}

/**
 * The obsidian executor side of the controls surface (step-06 #2/#6). The pure
 * `planSettingsWrite` decides WHICH write; this port carries it out against
 * `PersistenceServices`/`PluginDataStore`, resolves the target `TFile`,
 * surfaces a `Notice` on a non-persistable doc, then triggers an immediate
 * rebuild. Implemented by `ControlsActions`; consumed by the toolbar + node
 * components via context (Phase C).
 */
export interface ControlsActionsPort {
	/** Persist a planned settings write (depth / global), then rebuild. */
	applySettings(command: SettingsCommand): Promise<void>;
	/** Pin a regular node by its vault path (resolves + ensures a docid), then rebuild. */
	pinNode(path: string): Promise<void>;
	/** Unpin a pinned central by its docid, then rebuild. */
	unpinNode(docid: string): Promise<void>;
}

/**
 * Rebuilds EVERY open vicinity-graph view — the fan-out a global write needs,
 * because globals live in `data.json` and every open view renders from them.
 * Implemented in `main.ts` over the plugin's own `refreshOpenViews()` (the
 * workspace leaf walk stays in the one class that owns the workspace), so the
 * controls executor never has to know that views come from leaves.
 */
export interface ViewsRefreshPort {
	refreshAllViews(): void;
}

/**
 * The slice of the OWNING view's controller the controls executor needs: which
 * doc is currently MAIN (every depth write targets it) and "rebuild just this
 * view" — the reach of a per-doc write, kept narrow by scope rather than by any
 * insulation between views (see `settingsWriteScope.ts`). Structurally
 * satisfied by `GraphViewController`; deliberately narrow so the executor is
 * testable with a plain fake and cannot reach the rest of the controller.
 * Contrast {@link ViewsRefreshPort}, which reaches ALL views.
 */
export interface OwningViewPort {
	currentMainPath(): string | null;
	handleSettingsChanged(): void;
}

/**
 * Runs the elk layout on an elk graph, returning it annotated with coordinates.
 * `forceLayout` carries the build's resolved tuning values into the d3-force
 * root refinement; when omitted the implementation uses the engine defaults.
 */
export interface GraphLayoutPort {
	layout(graph: ElkNode, forceLayout?: ForceLayoutSettings): Promise<ElkNode>;
}

/** How a clicked note opens (step-05: ctrl/cmd-click = new tab). */
export interface OpenNoteOptions {
	/** `true` opens a NEW tab (`getLeaf(true)`); otherwise the current main-area leaf is reused. */
	readonly newTab: boolean;
	/**
	 * RAW heading text to position the note at (`OutlineEntry.rawText`); absent =
	 * the top of the note. The ADAPTER sanitises it into a link subpath with
	 * Obsidian's own `stripHeadingForLink` — callers pass it through verbatim.
	 */
	readonly heading?: string;
}

/** The slice of Obsidian navigation the controller needs: read the active file
 * and open a clicked node. Keeps the controller obsidian-free. */
export interface NoteNavigatorPort {
	activeFilePath(): string | null;
	openNote(path: string, options?: OpenNoteOptions): void;
}

/**
 * The slice of navigation the rich node components need — deliberately ONE
 * method, so a node component can open a note (or one of its headings) without
 * reaching the whole {@link NoteNavigatorPort} or the controller. Delivered by
 * `NoteOpenContext`; kept out of {@link GraphUiPort} because that port's doc
 * comment explicitly splits navigation out of it (SRP).
 */
export interface NoteOpenPort {
	openNote(path: string, options: OpenNoteOptions): void;
}

/** Fires Obsidian's native `hover-link` page preview for a hovered node. */
export interface HoverPreviewRequest {
	readonly nativeEvent: MouseEvent;
	/** The hovered node element the popover anchors to. */
	readonly targetEl: HTMLElement;
	/** Vault path of the hovered note. */
	readonly path: string;
}

/** Opens the native attachment menu for one icon-strip chip. */
export interface AttachmentMenuRequest {
	readonly nativeEvent: MouseEvent;
	/** The attachment vault paths listed as menu entries. */
	readonly paths: readonly string[];
}

/** One entry of a node's right-click menu (step-06: pin / unpin). */
export interface NodeMenuEntry {
	readonly title: string;
	/** Built-in (lucide) icon id, e.g. `"pin"` / `"pin-off"`. */
	readonly iconId: string;
	/** The action to run — carries the resolved pin/unpin call, so the adapter needs no actions reference. */
	readonly onClick: () => void;
}

/** Opens the native right-click menu for a node (pin/unpin). */
export interface NodeMenuRequest {
	readonly nativeEvent: MouseEvent;
	readonly entry: NodeMenuEntry;
}

/**
 * Obsidian UI services the rich node components need (step-05). Split from
 * {@link NoteNavigatorPort} so navigation stays navigation (SRP) and the React
 * components — which receive this port via context — never import `obsidian`
 * directly (that includes icon rendering, hence {@link GraphUiPort.renderIcon}).
 */
export interface GraphUiPort {
	/** App-servable URL for a vault file; `null` when the path resolves to no file. */
	resourcePath(path: string): string | null;
	showHoverPreview(request: HoverPreviewRequest): void;
	showAttachmentMenu(request: AttachmentMenuRequest): void;
	/** Opens the native pin/unpin menu at the cursor for a right-clicked node. */
	showNodeMenu(request: NodeMenuRequest): void;
	/** Renders a built-in (lucide) icon into `el`, replacing its content. */
	renderIcon(el: HTMLElement, iconId: string): void;
}
