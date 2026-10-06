import type { EdgeRelationship } from "../engine";
import type { EdgeRelationshipsPort } from "./viewPorts";

type Subscriber = () => void;

const NO_RELATIONSHIPS: ReadonlyMap<string, EdgeRelationship> = new Map();

/**
 * The view-layer side of {@link EdgeRelationshipsPort} (ticket
 * `nid_gk9h4jpa7di1al7och0rehd3h_e`): an external store
 * (`useSyncExternalStore`-shaped, like `LinkPreviewOverlayStore`) holding the
 * current build's relationship names keyed by `directedLinkKey`. Edge components
 * read it through `EdgeRelationshipContext`, so a name arriving after the build
 * repaints labels only — never nodes, never layout.
 */
export class EdgeRelationshipOverlayStore implements EdgeRelationshipsPort {
	private relationships: ReadonlyMap<string, EdgeRelationship> = NO_RELATIONSHIPS;
	private readonly subscribers = new Set<Subscriber>();

	readonly subscribe = (listener: Subscriber): (() => void) => {
		this.subscribers.add(listener);
		return () => this.subscribers.delete(listener);
	};

	readonly getSnapshot = (): ReadonlyMap<string, EdgeRelationship> => this.relationships;

	showEdgeRelationships(relationships: ReadonlyMap<string, EdgeRelationship>): void {
		// Clearing what is already clear is not a change — no re-render of every edge.
		if (relationships.size === 0 && this.relationships.size === 0) {
			return;
		}
		this.relationships = relationships;
		for (const listener of this.subscribers) {
			listener();
		}
	}
}
