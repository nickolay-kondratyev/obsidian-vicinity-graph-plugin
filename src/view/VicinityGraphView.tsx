import { ItemView } from "obsidian";
import type { ViewStateResult, WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { VicinityGraphBuilder } from "../adapters/VicinityGraphBuilder";
import type { LinkOccurrenceProvider } from "../engine";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import { ControlsActions } from "./ControlsActions";
import { LibavoidEdgeRouter } from "./edgeRouting";
import { GraphLayoutRunner } from "./GraphLayoutRunner";
import { GraphViewController } from "./GraphViewController";
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
		const ui = new ObsidianGraphUi(this.app, VIEW_TYPE_VICINITY_GRAPH, this);
		// The in-graph preview drawer's model store (replaces the old modal seam):
		// the controller writes it, the flow renders it — one store per view.
		const linkPreview = new LinkPreviewOverlayStore();
		const controller = new GraphViewController(
			navigator,
			this.graphBuilder,
			new GraphLayoutRunner(),
			new LibavoidEdgeRouter(),
			this.occurrenceProvider,
			linkPreview,
		);
		this.controller = controller;
		const controlsActions = new ControlsActions(
			this.persistenceServices,
			this.app.vault,
			this.settingsWrites,
			this.notices,
		);
		this.controlsActions = controlsActions;
		this.registerGraphEvents(controller, navigator);
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

	/**
	 * V1 persists NOTHING view-specific (CLARIFICATION Q4): no view-settings UI
	 * exists until step-06 and scroll/zoom is intentionally not saved. The
	 * overrides stay so multi-view workspace restore round-trips cleanly — each
	 * leaf simply re-follows the active file on restore.
	 */
	getState(): Record<string, unknown> {
		return super.getState();
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		await super.setState(state, result);
	}

	private registerGraphEvents(controller: GraphViewController, navigator: NoteNavigatorPort): void {
		const trackActiveFile = (): void => controller.handleActiveFileChanged(navigator.activeFilePath());
		this.registerEvent(this.app.workspace.on("active-leaf-change", trackActiveFile));
		this.registerEvent(this.app.workspace.on("file-open", trackActiveFile));
		this.registerEvent(this.app.metadataCache.on("resolved", () => controller.handleMetadataResolved()));
	}
}
