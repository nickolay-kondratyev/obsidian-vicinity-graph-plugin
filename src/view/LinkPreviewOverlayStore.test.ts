import { describe, expect, it, vi } from "vitest";
import { asVaultPath } from "../engine";
import { LinkPreviewOverlayStore } from "./LinkPreviewOverlayStore";
import { LinkPreviewModels } from "./linkPreviewModel";
import type { LinkPreviewModel } from "./linkPreviewModel";

const NOTE = asVaultPath("notes/center.md");
const OTHER = asVaultPath("notes/other.md");

function nodeModel(path = NOTE): LinkPreviewModel {
	return LinkPreviewModels.node({ path, outline: [], outgoing: [], backlinks: [] });
}

describe("LinkPreviewOverlayStore", () => {
	it("WHEN nothing was shown THEN the snapshot is null", () => {
		expect(new LinkPreviewOverlayStore().getSnapshot()).toBeNull();
	});

	it("WHEN a model is shown THEN the snapshot is that model and subscribers are notified", () => {
		const store = new LinkPreviewOverlayStore();
		const listener = vi.fn();
		store.subscribe(listener);
		const model = nodeModel();
		store.showLinkPreview(model);
		expect(store.getSnapshot()).toBe(model);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("WHEN a second model is shown THEN it replaces the first", () => {
		const store = new LinkPreviewOverlayStore();
		store.showLinkPreview(nodeModel());
		const second = nodeModel(OTHER);
		store.showLinkPreview(second);
		expect(store.getSnapshot()).toBe(second);
	});

	it("WHEN close is called THEN the snapshot is null and subscribers are notified", () => {
		const store = new LinkPreviewOverlayStore();
		store.showLinkPreview(nodeModel());
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
		store.showLinkPreview(nodeModel());
		expect(listener).not.toHaveBeenCalled();
	});
});
