import type { EdgePreviewModel } from "./linkPreviewModel";
import type { LinkPreviewPort } from "./viewPorts";

type Subscriber = () => void;

/**
 * The view-layer side of {@link LinkPreviewPort} (ticket
 * `nid_5j9mygfywppaiakuim3utf6r2_e`): an external store
 * (`useSyncExternalStore`-shaped, like `GraphViewController`) holding the
 * currently previewed model, rendered by `VicinityGraphFlow` as an in-graph
 * slide-out drawer instead of the retired Obsidian modal. `null` = no drawer.
 *
 * Pure and obsidian-free on purpose — the drawer lives INSIDE the graph's
 * React tree, so showing/closing is just state, not window chrome.
 */
export class LinkPreviewOverlayStore implements LinkPreviewPort {
	private model: EdgePreviewModel | null = null;
	private readonly subscribers = new Set<Subscriber>();

	readonly subscribe = (listener: Subscriber): (() => void) => {
		this.subscribers.add(listener);
		return () => this.subscribers.delete(listener);
	};

	readonly getSnapshot = (): EdgePreviewModel | null => this.model;

	/** Show (or replace) the previewed model — a later click simply retargets the drawer. */
	showLinkPreview(model: EdgePreviewModel): void {
		this.model = model;
		this.notify();
	}

	/** Dismiss the drawer. No-op (no re-notify) when nothing is shown. */
	close(): void {
		if (this.model === null) {
			return;
		}
		this.model = null;
		this.notify();
	}

	private notify(): void {
		for (const listener of this.subscribers) {
			listener();
		}
	}
}
