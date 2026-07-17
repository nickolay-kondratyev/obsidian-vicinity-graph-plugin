import { ItemView } from "obsidian";
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { HelloGraph } from "./HelloGraph";

export const VIEW_TYPE_NEIGHBORHOOD_GRAPH = "neighborhood-graph-view";

/** ItemView shell that owns the React root lifecycle: mount on open, unmount on close. */
export class NeighborhoodGraphView extends ItemView {
	private root: Root | null = null;

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
		this.root = createRoot(this.contentEl);
		this.root.render(
			<StrictMode>
				<HelloGraph />
			</StrictMode>,
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}
