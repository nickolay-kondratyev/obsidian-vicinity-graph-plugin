import type { Workspace, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_VICINITY_GRAPH } from "./VicinityGraphView";

/**
 * Where a graph view lives. Deliberately coarse — it names the REGION a leaf
 * sits in, not an exact pane, because that is what "is it already where I asked
 * for?" can honestly be answered about.
 */
export type GraphViewPlacement =
	/** Docked in the right sidebar (`getRightLeaf`) — the original placement. */
	| "right-sidebar"
	/** A main-area pane; opened by splitting the active tab DOWNWARD. */
	| "main-area";

/**
 * Opens the vicinity graph at a chosen {@link GraphViewPlacement}, keeping ONE
 * graph view in the workspace: asking for a placement the current view is not
 * at MOVES it (detach + re-create), so "open below" on a sidebar-docked graph
 * reads as a move, not a second copy (human-aligned, CLARIFICATION Q3).
 *
 * A view already in the requested region is only revealed — no detach — so a
 * repeat invocation never costs a rebuild.
 *
 * Obsidian-bound by construction (workspace splits are not fakeable), so it
 * carries no unit test; it is covered by the e2e suite like the other
 * `Obsidian*` view adapters.
 */
export class GraphViewOpener {
	constructor(private readonly workspace: Workspace) {}

	async open(placement: GraphViewPlacement): Promise<void> {
		const existing = this.workspace.getLeavesOfType(VIEW_TYPE_VICINITY_GRAPH);
		const alreadyPlaced = existing.find((leaf) => this.placementOf(leaf) === placement);
		if (alreadyPlaced !== undefined) {
			await this.workspace.revealLeaf(alreadyPlaced);
			return;
		}
		for (const leaf of existing) {
			leaf.detach();
		}
		const leaf = this.createLeaf(placement);
		if (leaf === null) {
			return;
		}
		await leaf.setViewState({ type: VIEW_TYPE_VICINITY_GRAPH, active: true });
		await this.workspace.revealLeaf(leaf);
	}

	/** `'horizontal'` is Obsidian's direction for a split BELOW (core "Split down"). */
	private createLeaf(placement: GraphViewPlacement): WorkspaceLeaf | null {
		return placement === "right-sidebar"
			? this.workspace.getRightLeaf(false)
			: this.workspace.getLeaf("split", "horizontal");
	}

	private placementOf(leaf: WorkspaceLeaf): GraphViewPlacement | null {
		const root = leaf.getRoot();
		if (root === this.workspace.rightSplit) {
			return "right-sidebar";
		}
		// Pop-out windows have their own root split, so identity against
		// `rootSplit` (not "is not the sidebar") is what keeps this honest.
		return root === this.workspace.rootSplit ? "main-area" : null;
	}
}
