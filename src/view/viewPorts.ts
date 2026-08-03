import type { ElkNode } from "elkjs";
import type { ForceLayoutSettings, ViewSettings, VicinityGraph } from "../engine";
import type { ControlsModel } from "./ControlsModel";
import type { EdgePreviewModel } from "./linkPreviewModel";
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
	/**
	 * The view globals as they are STORED NOW — the read a control needs when its
	 * verdict judges one field against its SIBLINGS (today: max px vs min px).
	 *
	 * WHY not the rendered snapshot: that snapshot only moves once the write has
	 * persisted AND the traversal and layout have rebuilt, which is the exact latency
	 * the optimistic controls exist to hide. Judging inside that window against it
	 * would refuse a legitimate edit while quoting a sibling value the user has
	 * already replaced. The settings tab reads `PluginDataStore.globalView()` for the
	 * same reason; this is that read, reached from React.
	 */
	storedGlobalView(): ViewSettings;
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
 * Tells the USER something they must know — one transient message, Obsidian's
 * `Notice`. Behind a port for the same reason {@link ViewsRefreshPort} is: the code
 * that DECIDES a message is warranted (today `SettingsWritePipeline`, whose failure
 * policy lives in one place) is unit-tested with no obsidian runtime, over
 * `FakeUserNotices`. Implemented in `main.ts`, the class that already owns the
 * plugin's obsidian surface.
 *
 * Deliberately message-only: no title, no duration, no severity. A caller that wants
 * to say more says it in the message, so there is no notice VOCABULARY to keep
 * consistent across surfaces.
 */
export interface UserNoticePort {
	show(message: string): void;
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
	 * Mutually exclusive with {@link line}.
	 */
	readonly heading?: string;
	/**
	 * 0-based line to position the note at (`LinkContextSnippet.line`, the
	 * editor's `eState.line` coordinate) — the link-preview drawer's GO
	 * navigation. Mutually exclusive with {@link heading}; when both are given,
	 * `line` wins (it is the more precise coordinate).
	 */
	readonly line?: number;
}

/** The slice of Obsidian navigation the controller needs: read the active file
 * and open a clicked node. Keeps the controller obsidian-free. */
export interface NoteNavigatorPort {
	activeFilePath(): string | null;
	openNote(path: string, options?: OpenNoteOptions): void;
	/**
	 * Opens a LINKTEXT (`[[Note#Heading]]` target text, not a vault path) exactly
	 * as Obsidian resolves it in `sourcePath`'s editor — the click handler behind
	 * `a.internal-link` anchors in {@link GraphUiPort.renderMarkdown} output,
	 * which Obsidian only auto-wires inside a real markdown view. An unresolved
	 * linktext gets Obsidian's stock behaviour (offer to create the note), the
	 * same as clicking it in the source note.
	 */
	openMarkdownLink(linktext: string, sourcePath: string): void;
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

/**
 * Shows the link preview for an already-built model (parent ticket
 * `nid_tohotgq2s92dvd1iov1rd0umv_e`). Its own port — not a {@link GraphUiPort}
 * method — because the CALLER is the controller (the one class allowed to run
 * the async occurrence queries a model needs), not a node component; how the
 * preview is presented (today the in-graph slide-out drawer, ticket
 * `nid_5j9mygfywppaiakuim3utf6r2_e`) stays behind this seam. Implemented by
 * `LinkPreviewOverlayStore`, rendered by `VicinityGraphFlow`.
 */
export interface LinkPreviewPort {
	showLinkPreview(model: EdgePreviewModel): void;
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
	showAttachmentMenu(request: AttachmentMenuRequest): void;
	/** Opens the native pin/unpin menu at the cursor for a right-clicked node. */
	showNodeMenu(request: NodeMenuRequest): void;
	/** Renders a built-in (lucide) icon into `el`, replacing its content. */
	renderIcon(el: HTMLElement, iconId: string): void;
	/**
	 * Renders a markdown string into `el` with Obsidian's own renderer,
	 * replacing `el`'s content (safe to re-run on the same element). Wiki links
	 * resolve against `sourcePath` — the note the markdown was read from — and
	 * come out as `a.internal-link` anchors; clicks on those are NOT auto-wired
	 * outside a markdown view, so callers route them through
	 * {@link NoteNavigatorPort.openMarkdownLink}.
	 */
	renderMarkdown(el: HTMLElement, markdown: string, sourcePath: string): Promise<void>;
}
