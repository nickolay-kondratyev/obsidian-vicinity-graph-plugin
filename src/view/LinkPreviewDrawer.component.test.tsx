// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { asVaultPath } from "../engine";
import type { LinkPreviewGoTarget } from "./LinkPreviewContent";
import { LinkPreviewDrawer } from "./LinkPreviewDrawer";
import { LinkPreviewModels } from "./linkPreviewModel";
import type { LinkPreviewModel } from "./linkPreviewModel";

/**
 * RENDERED behaviour of the in-graph link-preview drawer (ticket
 * `nid_5j9mygfywppaiakuim3utf6r2_e`): title per model kind, the close
 * affordances (button, Escape) and the close-on-GO contract the modal used to
 * own. Content behaviour itself is covered by LinkPreviewContent's own suite.
 */

const NOTE = asVaultPath("notes/center.md");
const SOURCE = asVaultPath("notes/alpha.md");
const TARGET = asVaultPath("notes/beta.md");

function nodeModel(): LinkPreviewModel {
	return LinkPreviewModels.node({
		path: NOTE,
		outline: [],
		outgoing: [
			{
				targetPath: TARGET,
				offset: 30,
				context: { shortContext: "short@3", expandedContext: "expanded@3", line: 3 },
			},
		],
		backlinks: [],
	});
}

function edgeModel(): LinkPreviewModel {
	return LinkPreviewModels.edge({ sourcePath: SOURCE, targetPath: TARGET, occurrences: [] });
}

function renderDrawer(model: LinkPreviewModel): {
	onClose: ReturnType<typeof vi.fn>;
	goTargets: LinkPreviewGoTarget[];
} {
	const onClose = vi.fn();
	const goTargets: LinkPreviewGoTarget[] = [];
	render(
		<LinkPreviewDrawer
			model={model}
			renderIcon={(el, iconId) => el.setAttribute("data-icon-id", iconId)}
			onClose={onClose}
			onGo={(target) => goTargets.push(target)}
		/>,
	);
	return { onClose, goTargets };
}

afterEach(cleanup);

describe("LinkPreviewDrawer", () => {
	it("WHEN a node model renders THEN the drawer is a dialog titled with the note title", () => {
		renderDrawer(nodeModel());
		expect(screen.getByRole("dialog", { name: "center" })).toBeTruthy();
	});

	it("WHEN an edge model renders THEN the drawer title is 'source → target'", () => {
		renderDrawer(edgeModel());
		expect(screen.getByRole("dialog", { name: "alpha → beta" })).toBeTruthy();
	});

	it("WHEN the close button is clicked THEN onClose fires", () => {
		const { onClose } = renderDrawer(nodeModel());
		fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("WHEN Escape is pressed THEN onClose fires", () => {
		const { onClose } = renderDrawer(nodeModel());
		fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("WHEN a GO button is clicked THEN the target is reported AND the drawer closes", () => {
		const { onClose, goTargets } = renderDrawer(nodeModel());
		fireEvent.click(screen.getByRole("button", { name: /^Go to line 4/ }));
		expect(goTargets).toEqual([{ path: NOTE, line: 3 }]);
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
