import { Plugin, WorkspaceLeaf } from "obsidian";
import { DocIdServices } from "obsidian-id-lib";
import type { DocIdService } from "obsidian-id-lib";
import { NeighborhoodGraphView, VIEW_TYPE_NEIGHBORHOOD_GRAPH } from "./view/NeighborhoodGraphView";

// manifest.json minAppVersion WHY: 1.12.4 is the first PUBLIC Obsidian release where
// canvas backlinks are core-indexed (resolvedLinks/graph; EA 1.12.0, 2026-02). It is a
// floor, never a ceiling — newer versions must keep working. Canvas
// `metadata.frontmatter` (used by obsidian-id-lib) was NOT introduced by any core
// version; it rides canvas's documented arbitrary-key forward compatibility.

export default class NeighborhoodGraphPlugin extends Plugin {
	/**
	 * WHY wired in step-01: proves obsidian-id-lib type-checks and bundles through our
	 * esbuild (raw-TS submodule consumption smoke check). Construction does no IO.
	 * Real consumers arrive with step-03 (adapters & persistence).
	 * Private until a real consumer exists; step-03 decides final visibility.
	 */
	private docIdService!: DocIdService;

	async onload(): Promise<void> {
		this.docIdService = DocIdServices.createDefault(this.app.vault);

		this.registerView(VIEW_TYPE_NEIGHBORHOOD_GRAPH, (leaf) => new NeighborhoodGraphView(leaf));

		this.addCommand({
			id: "open-neighborhood-graph",
			name: "Open neighborhood graph",
			callback: () => void this.activateView(),
		});
	}

	private async activateView(): Promise<void> {
		const { workspace } = this.app;
		const leaf: WorkspaceLeaf | null =
			workspace.getLeavesOfType(VIEW_TYPE_NEIGHBORHOOD_GRAPH)[0] ?? workspace.getRightLeaf(false);
		if (leaf === null) {
			return;
		}
		await leaf.setViewState({ type: VIEW_TYPE_NEIGHBORHOOD_GRAPH, active: true });
		await workspace.revealLeaf(leaf);
	}
}
