import { ItemView } from "obsidian";
import type { ViewStateResult, WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { NeighborhoodGraphBuilder } from "../adapters/NeighborhoodGraphBuilder";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { GraphViewController } from "./GraphViewController";
import { NeighborhoodGraphFlow } from "./NeighborhoodGraphFlow";
import { ObsidianNoteNavigator } from "./ObsidianNoteNavigator";
import type { NoteNavigatorPort } from "./viewPorts";

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

	constructor(
		leaf: WorkspaceLeaf,
		private readonly graphBuilder: NeighborhoodGraphBuilder,
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
		this.controller = controller;
		this.registerGraphEvents(controller, navigator);
		controller.start();

		this.root = createRoot(this.contentEl);
		this.root.render(
			<StrictMode>
				<NeighborhoodGraphFlow controller={controller} />
			</StrictMode>,
		);
	}

	async onClose(): Promise<void> {
		this.controller?.dispose();
		this.controller = null;
		this.root?.unmount();
		this.root = null;
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
