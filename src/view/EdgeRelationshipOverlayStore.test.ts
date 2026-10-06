import { describe, expect, it, vi } from "vitest";
import type { EdgeRelationship } from "../engine";
import { EdgeRelationshipOverlayStore } from "./EdgeRelationshipOverlayStore";

const NAMED: ReadonlyMap<string, EdgeRelationship> = new Map([["a\u0000b", { name: "improves", origin: "syntax" }]]);

describe("EdgeRelationshipOverlayStore", () => {
	it("WHEN nothing was shown THEN the snapshot is empty", () => {
		expect(new EdgeRelationshipOverlayStore().getSnapshot().size).toBe(0);
	});

	it("WHEN names are shown THEN the snapshot is those names", () => {
		const store = new EdgeRelationshipOverlayStore();
		store.showEdgeRelationships(NAMED);
		expect(store.getSnapshot()).toBe(NAMED);
	});

	it("WHEN names are shown THEN subscribers are notified", () => {
		const store = new EdgeRelationshipOverlayStore();
		const listener = vi.fn();
		store.subscribe(listener);
		store.showEdgeRelationships(NAMED);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("WHEN an empty map is shown over names THEN the names are cleared", () => {
		const store = new EdgeRelationshipOverlayStore();
		store.showEdgeRelationships(NAMED);
		store.showEdgeRelationships(new Map());
		expect(store.getSnapshot().size).toBe(0);
	});

	it("WHEN an empty map is shown over no names THEN subscribers are not notified", () => {
		const store = new EdgeRelationshipOverlayStore();
		const listener = vi.fn();
		store.subscribe(listener);
		store.showEdgeRelationships(new Map());
		expect(listener).not.toHaveBeenCalled();
	});
});
