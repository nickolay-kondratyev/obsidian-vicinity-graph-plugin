import type { ElkNode } from "elkjs";
import type { ForceLayoutSettings, VicinityGraph } from "../engine";
import type { ControlsModel } from "./ControlsModel";
import type { SettingsResetScope } from "./settingsResetPlan";
import type { SettingsInteraction } from "./settingsWritePlan";

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
 * The obsidian executor side of the controls surface (step-06 #2/#6). Controls
 * describe WHAT the user did (a {@link SettingsInteraction}); everything after
 * that — serialisation, planning the write against the globals as they are at
 * WRITE time, persisting, and the refresh fan-out — belongs to
 * `SettingsWritePipeline` behind this port.
 *
 * WHY an interaction and not a ready-made command: a control can only build a
 * command from the snapshot it RENDERED from, and a stale merge base silently
 * reverts whatever sibling field moved in between.
 *
 * A rebuild follows only what LANDED: a refused write (a doc with no stable id)
 * changes no rendered state, so nothing rebuilds. Everything that DOES land is
 * global state in `data.json`, so it fans out to EVERY open view. Implemented by
 * `ControlsActions`; consumed by the panel + node components via context.
 */
export interface ControlsActionsPort {
	/** Persist what the user just did (all settings are global); then rebuild every open view. */
	applySettings(interaction: SettingsInteraction): Promise<void>;
	/** Restore one settings section's shipped defaults; then rebuild every open view. */
	restoreDefaults(scope: SettingsResetScope): Promise<void>;
	/** Pin a regular node by its vault path (resolves + ensures a docid); rebuilds every view if it landed. */
	pinNode(path: string): Promise<void>;
	/** Unpin a pinned central by its docid — always lands — then rebuild every view. */
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
