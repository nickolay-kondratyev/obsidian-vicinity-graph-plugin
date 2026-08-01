import { describe, expect, it, vi } from "vitest";
import { LinkPreviewOverlayStore } from "./LinkPreviewOverlayStore";
import { LinkPreviewModels } from "./linkPreviewModel";
import type { EdgePreviewModel } from "./linkPreviewModel";

function edgeModel(sourceName = "center"): EdgePreviewModel {
	return LinkPreviewModels.edge({ sourceName, targetName: "target", bidirectional: false, pairs: [] });
}

describe("LinkPreviewOverlayStore", () => {
	it("WHEN nothing was shown THEN the snapshot is null", () => {
		expect(new LinkPreviewOverlayStore().getSnapshot()).toBeNull();
	});

	it("WHEN a model is shown THEN the snapshot is that model and subscribers are notified", () => {
		const store = new LinkPreviewOverlayStore();
		const listener = vi.fn();
		store.subscribe(listener);
		const model = edgeModel();
		store.showLinkPreview(model);
		expect(store.getSnapshot()).toBe(model);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("WHEN a second model is shown THEN it replaces the first", () => {
		const store = new LinkPreviewOverlayStore();
		store.showLinkPreview(edgeModel());
		const second = edgeModel("other");
		store.showLinkPreview(second);
		expect(store.getSnapshot()).toBe(second);
	});

	it("WHEN close is called THEN the snapshot is null and subscribers are notified", () => {
		const store = new LinkPreviewOverlayStore();
		store.showLinkPreview(edgeModel());
		const listener = vi.fn();
		store.subscribe(listener);
		store.close();
		expect(store.getSnapshot()).toBeNull();
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("WHEN close is called with nothing shown THEN subscribers are NOT re-notified", () => {
		const store = new LinkPreviewOverlayStore();
		const listener = vi.fn();
		store.subscribe(listener);
		store.close();
		expect(listener).not.toHaveBeenCalled();
	});

	it("WHEN a subscriber unsubscribes THEN it stops receiving notifications", () => {
		const store = new LinkPreviewOverlayStore();
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);
		unsubscribe();
		store.showLinkPreview(edgeModel());
		expect(listener).not.toHaveBeenCalled();
	});
});
