import { ItemView } from "obsidian";
import type { ViewStateResult, WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { FolderNoteIndex } from "../adapters/FolderNoteIndex";
import { ChildNoteCreator } from "../adapters/ChildNoteCreator";
import type { NoteCreationPort } from "../adapters/obsidianPorts";
import type { VicinityGraphBuilder } from "../adapters/VicinityGraphBuilder";
import type { LinkOccurrenceProvider } from "../engine";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import { ControlsActions } from "./ControlsActions";
import { LibavoidEdgeRouter } from "./edgeRouting";
import { HierarchicalEdgeRouter } from "./hierarchicalEdgeRouting";
import { GraphLayoutRunner } from "./GraphLayoutRunner";
import { GRAPH_MODE_STATE_KEY, GraphModes, NOTE_GRAPH_MODE } from "./graphMode";
import type { GraphMode } from "./graphMode";
import { GraphViewController } from "./GraphViewController";
import type { Tag } from "../shared/Tags";
import { VicinityGraphFlow } from "./VicinityGraphFlow";
import { LinkPreviewOverlayStore } from "./LinkPreviewOverlayStore";
import { ObsidianGraphUi } from "./ObsidianGraphUi";
import { ObsidianNoteNavigator } from "./ObsidianNoteNavigator";
import type { SettingsWritePipeline } from "./settingsWritePipeline";
import type { ControlsActionsPort, NoteNavigatorPort, UserNoticePort, ViewsRefreshPort } from "./viewPorts";

export const VIEW_TYPE_VICINITY_GRAPH = "vicinity-graph-view";

/**
 * ItemView shell. Kept thin on purpose: it owns the React root and Obsidian
 * event lifecycle only, and delegates every rebuild decision to
 * {@link GraphViewController} and the pure modules under it. Registered as a
 * right-sidebar view (draggable to the main area) in `main.ts`.
 */
export class VicinityGraphView extends ItemView {
	private root: Root | null = null;
	private controller: GraphViewController | null = null;
	/** Built in `onOpen` alongside the controller; handed to the flow (Phase C). */
	private controlsActions: ControlsActions | null = null;
	/**
	 * This leaf's graph mode (tags-v1), mirrored from the controller so it can be
	 * saved ({@link getState}) and so a mode that arrives BEFORE the controller
	 * exists — a restored workspace's {@link setState}, or {@link enterTagMode} on a
	 * leaf that has not opened yet — is applied in {@link onOpen} rather than lost.
	 */
	private graphMode: GraphMode = NOTE_GRAPH_MODE;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly graphBuilder: VicinityGraphBuilder,
		private readonly persistenceServices: PersistenceServices,
		/** Fan-out for pin writes made from THIS view's controls panel; owned by the plugin. */
		private readonly viewsRefresh: ViewsRefreshPort,
		/** The ONE settings write pipeline, shared with the settings tab; owned by the plugin. */
		private readonly settingsWrites: SettingsWritePipeline,
		/** The ONE user-message surface; owned by the plugin, which is where `Notice` lives. */
		private readonly notices: UserNoticePort,
		/** Per-query occurrence snapshots for the link-preview drawer; owned by the plugin. */
		private readonly occurrenceProvider: LinkOccurrenceProvider,
		/** Plugin-lived folder-note index — the owned-folder half of the create-child-note action. */
		private readonly folderNoteIndex: FolderNoteIndex,
		/** Plugin-lived vault-write seam — the create + folderExists half of the child-note action. */
		private readonly noteCreation: NoteCreationPort,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_VICINITY_GRAPH;
	}

	getDisplayText(): string {
		return "Vicinity graph";
	}

	getIcon(): string {
		return "network";
	}

	async onOpen(): Promise<void> {
		const navigator = new ObsidianNoteNavigator(this.app);
		// `this` (the ItemView, a Component) owns rendered-markdown lifecycles.
		const ui = new ObsidianGraphUi(this.app, this);
		// The in-graph preview drawer's model store (replaces the old modal seam):
		// the controller writes it, the flow renders it — one store per view.
		const linkPreview = new LinkPreviewOverlayStore();
		const controller = new GraphViewController(
			navigator,
			this.graphBuilder,
			new GraphLayoutRunner(),
			new HierarchicalEdgeRouter(new LibavoidEdgeRouter()),
			this.occurrenceProvider,
			linkPreview,
			(mode) => this.rememberGraphMode(mode),
		);
		this.controller = controller;
		// The create-child-note action (vault-content write + open): resolves the owned
		// folder through the plugin-lived index, writes/checks folders through the write
		// seam, opens through the navigator (its openNote satisfies NoteOpenPort).
		const childNoteCreator = new ChildNoteCreator(
			this.folderNoteIndex,
			this.noteCreation,
			this.app.vault,
			navigator,
			this.notices,
		);
		const controlsActions = new ControlsActions(
			this.persistenceServices,
			this.app.vault,
			this.settingsWrites,
			this.notices,
			// The controller owns which note the graph is built around — the MAIN a local
			// pin is scoped to (a clicked node re-centres it before the active-file event).
			controller,
			childNoteCreator,
		);
		this.controlsActions = controlsActions;
		this.registerGraphEvents(controller, navigator);
		// A mode restored before the controller existed: enter it FIRST, so the first
		// build is the tag's and start() (which only follows the active note) no-ops.
		if (this.graphMode.kind === "tag") {
			controller.enterTagMode(this.graphMode.tag);
		}
		controller.start();

		this.root = createRoot(this.contentEl);
		this.root.render(
			<StrictMode>
				<VicinityGraphFlow controller={controller} ui={ui} actions={controlsActions} linkPreview={linkPreview} />
			</StrictMode>,
		);
	}

	async onClose(): Promise<void> {
		this.controller?.dispose();
		this.controller = null;
		this.controlsActions = null;
		this.root?.unmount();
		this.root = null;
	}

	/**
	 * Rebuild this open view against fresh persisted state — the fan-out target
	 * for global settings-tab writes (step-06 #7). No-op before `onOpen`.
	 */
	refresh(): void {
		this.controller?.handleSettingsChanged();
	}

	/** The controls executor for this view (Phase C wires it into the flow's context). */
	getControlsActions(): ControlsActionsPort | null {
		return this.controlsActions;
	}

	// --- graph mode: THE enter/exit API of one view (tags-v1) ---------------
	// Entry points should go through the plugin (`VicinityGraphPlugin.enterTagMode`
	// / `exitTagMode`), which also opens/reveals the view; these are its per-view half.

	/**
	 * Show every note carrying `tag` (or a nested child tag) in THIS view, until
	 * {@link exitTagMode}. Safe before `onOpen`: the mode is applied when the view opens.
	 */
	enterTagMode(tag: Tag): void {
		if (this.controller === null) {
			this.rememberGraphMode(GraphModes.tag(tag));
			return;
		}
		this.controller.enterTagMode(tag);
	}

	/** Back to the vicinity of the active note. A no-op when not in tag mode. */
	exitTagMode(): void {
		if (this.controller === null) {
			this.rememberGraphMode(NOTE_GRAPH_MODE);
			return;
		}
		this.controller.exitTagMode();
	}

	/** The mode this view is in (the same value {@link getState} saves). */
	currentGraphMode(): GraphMode {
		return this.graphMode;
	}

	/**
	 * The ONE view-specific thing persisted per leaf: the graph mode (tags-v1
	 * decision 11), so a tag filter survives an Obsidian restart. Scroll/zoom is
	 * intentionally not saved, and settings are global (never per view).
	 */
	getState(): Record<string, unknown> {
		return { ...super.getState(), [GRAPH_MODE_STATE_KEY]: GraphModes.toSaved(this.graphMode) };
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
		// Obsidian also calls this with state that carries no mode at all (a plain
		// `setViewState({ type })`); an absent or unreadable mode leaves the current
		// one alone rather than silently dropping a filter.
		const saved = GraphModes.fromSaved(savedGraphModeOf(state));
		if (saved === undefined) {
			return;
		}
		if (saved.kind === "tag") {
			this.enterTagMode(saved.tag);
		} else {
			this.exitTagMode();
		}
	}

	/** Mirrors a mode change and asks Obsidian to save the workspace (debounced by Obsidian). */
	private rememberGraphMode(mode: GraphMode): void {
		this.graphMode = mode;
		this.app.workspace.requestSaveLayout();
	}

	private registerGraphEvents(controller: GraphViewController, navigator: NoteNavigatorPort): void {
		const trackActiveFile = (): void => controller.handleActiveFileChanged(navigator.activeFilePath());
		this.registerEvent(this.app.workspace.on("active-leaf-change", trackActiveFile));
		this.registerEvent(this.app.workspace.on("file-open", trackActiveFile));
		this.registerEvent(this.app.metadataCache.on("resolved", () => controller.handleMetadataResolved()));
		// A rename fires NEITHER active-leaf-change NOR file-open — the open note just
		// changed path. Without this the MAIN goes stale and the pane collapses to empty
		// under the still-open note (ticket nid_q3rscvfkznktgu1cqyybp54v1_e).
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => controller.handleMainRenamed(oldPath, file.path)),
		);
	}
}

function savedGraphModeOf(state: unknown): unknown {
	return typeof state === "object" && state !== null
		? (state as Readonly<Record<string, unknown>>)[GRAPH_MODE_STATE_KEY]
		: undefined;
}
