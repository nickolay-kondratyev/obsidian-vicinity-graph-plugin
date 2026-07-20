import { ItemView } from "obsidian";
import type { ViewStateResult, WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { NeighborhoodGraphBuilder } from "../adapters/NeighborhoodGraphBuilder";
import type { PersistenceServices } from "../persistence/PersistenceServices";
import type { PluginDataStore } from "../persistence/PluginDataStore";
import { ControlsActions } from "./ControlsActions";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { GraphViewController } from "./GraphViewController";
import { NeighborhoodGraphFlow } from "./NeighborhoodGraphFlow";
import { ObsidianGraphUi } from "./ObsidianGraphUi";
import { ObsidianNoteNavigator } from "./ObsidianNoteNavigator";
import type { ControlsActionsPort, NoteNavigatorPort } from "./viewPorts";

export const VIEW_TYPE_NEIGHBORHOOD_GRAPH = "neighborhood-graph-view";

/**
 * ItemView shell. Kept thin on purpose: it owns the React root and Obsidian
 * event lifecycle only, and delegates every rebuild decision to
 * {@link GraphViewController} and the pure modules under it. Registered as a
 * right-sidebar view (draggable to the main area) in `main.ts`.
 */
export class NeighborhoodGraphView extends ItemView {
	private root: Root | null = null;
	private controller: GraphViewController | null = null;
	/** Built in `onOpen` alongside the controller; handed to the flow (Phase C). */
	private controlsActions: ControlsActions | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly graphBuilder: NeighborhoodGraphBuilder,
		private readonly pluginDataStore: PluginDataStore,
		private readonly persistenceServices: PersistenceServices,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_NEIGHBORHOOD_GRAPH;
	}

	getDisplayText(): string {
		return "Neighborhood graph";
	}

	getIcon(): string {
		return "network";
	}

	async onOpen(): Promise<void> {
		const navigator = new ObsidianNoteNavigator(this.app);
		const controller = new GraphViewController(navigator, this.graphBuilder, new ElkLayoutRunner());
		const ui = new ObsidianGraphUi(this.app, VIEW_TYPE_NEIGHBORHOOD_GRAPH);
		this.controller = controller;
		this.controlsActions = new ControlsActions(controller, this.persistenceServices, this.pluginDataStore, this.app);
		this.registerGraphEvents(controller, navigator);
		controller.start();

		this.root = createRoot(this.contentEl);
		this.root.render(
			<StrictMode>
				<NeighborhoodGraphFlow controller={controller} ui={ui} />
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
