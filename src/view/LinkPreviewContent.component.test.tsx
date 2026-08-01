// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LinkOccurrence } from "../engine";
import { asVaultPath } from "../engine";
import type { LinkPreviewGoTarget } from "./LinkPreviewContent";
import { GO_ICON_ID, LinkPreviewContent } from "./LinkPreviewContent";
import { LinkPreviewModels } from "./linkPreviewModel";

/**
 * RENDERED behaviour of the link-preview drawer content: row toggling, bulk
 * button enablement, GO payloads, fallback rows, empty states. Driven through
 * plain recording fakes of the two function ports — the drawer shell itself is
 * obsidian-coupled and e2e-covered.
 */

const NOTE = asVaultPath("notes/center.md");
const TARGET = asVaultPath("notes/target.md");
const SOURCE_A = asVaultPath("notes/alpha.md");
const SOURCE_B = asVaultPath("notes/beta.md");

/** Occurrence whose snippet came from `line`; `line === null` = fallback path (no position). */
function occurrenceAt(line: number | null): LinkOccurrence {
	return line === null
		? { offset: null, context: null }
		: { offset: line * 10, context: { shortContext: `short@${line}`, expandedContext: `expanded@${line}`, line } };
}

/** One renderMarkdown seam call, as the fake recorded it. */
interface MarkdownRenderCall {
	readonly markdown: string;
	readonly sourcePath: string;
}

/** One onOpenLink report from a clicked rendered internal link. */
interface OpenedLink {
	readonly linktext: string;
	readonly sourcePath: string;
}

/** Everything the recording fakes captured for one rendered content. */
interface RenderedContentRecorders {
	readonly goTargets: LinkPreviewGoTarget[];
	readonly markdownCalls: MarkdownRenderCall[];
	readonly openedLinks: OpenedLink[];
}

/**
 * Renders through recording fakes. The renderMarkdown fake mimics the ONE
 * Obsidian output shape the component depends on: `[[X]]` becomes an
 * `a.internal-link` anchor carrying the linktext on `data-href`; everything
 * else stays text (so `getByText` keeps working on snippets).
 */
function renderContent(model: Parameters<typeof LinkPreviewContent>[0]["model"]): RenderedContentRecorders {
	const recorders: RenderedContentRecorders = { goTargets: [], markdownCalls: [], openedLinks: [] };
	render(
		<LinkPreviewContent
			model={model}
			renderIcon={(el, iconId) => el.setAttribute("data-icon-id", iconId)}
			renderMarkdown={(el, markdown, sourcePath) => {
				recorders.markdownCalls.push({ markdown, sourcePath });
				el.replaceChildren();
				for (const part of markdown.split(/(\[\[[^\]]+\]\])/)) {
					const wikiLink = /^\[\[([^\]]+)\]\]$/.exec(part);
					const linktext = wikiLink?.[1];
					if (linktext === undefined) {
						el.appendChild(el.ownerDocument.createTextNode(part));
						continue;
					}
					const anchor = el.ownerDocument.createElement("a");
					anchor.className = "internal-link";
					anchor.setAttribute("data-href", linktext);
					anchor.textContent = linktext;
					el.appendChild(anchor);
				}
				return Promise.resolve();
			}}
			onOpenLink={(linktext, sourcePath) => recorders.openedLinks.push({ linktext, sourcePath })}
			onGo={(target) => recorders.goTargets.push(target)}
		/>,
	);
	return recorders;
}

/** Edge model with neutral endpoint names — pair grouping is what these tests exercise. */
function edgeModel(
	pairs: Parameters<typeof LinkPreviewModels.edge>[0]["pairs"],
): ReturnType<typeof LinkPreviewModels.edge> {
	return LinkPreviewModels.edge({ sourceName: "center", targetName: "target", bidirectional: false, pairs });
}

/** The default single-pair model: center.md → target.md with one row per given line. */
function singlePairModel(lines: readonly (number | null)[]): ReturnType<typeof LinkPreviewModels.edge> {
	return edgeModel([{ sourcePath: NOTE, targetPath: TARGET, occurrences: lines.map(occurrenceAt) }]);
}

const expandAll = (): HTMLElement => screen.getByRole("button", { name: "Expand all" });
const collapseAll = (): HTMLElement => screen.getByRole("button", { name: "Collapse all" });
/** Every context-row toggle, in display order. */
const rowToggles = (): HTMLElement[] =>
	screen.queryAllByRole("button", { expanded: false }).concat(screen.queryAllByRole("button", { expanded: true }));

afterEach(cleanup);

describe("LinkPreviewContent sections", () => {
	it("WHEN an edge model renders THEN only the single occurrences section appears", () => {
		renderContent(singlePairModel([3]));
		const titles = screen.getAllByRole("region").map((section) => section.getAttribute("aria-label"));
		expect(titles).toEqual(["Link occurrences"]);
	});

	it("WHEN an edge model has ONE pair THEN its rows render flat, with no from→to group header", () => {
		renderContent(singlePairModel([3]));
		expect(screen.queryAllByRole("heading", { level: 4 })).toEqual([]);
	});

	it("WHEN an edge model has several pairs THEN each pair is headed by 'source → target' titles", () => {
		renderContent(
			edgeModel([
				{ sourcePath: SOURCE_B, targetPath: TARGET, occurrences: [occurrenceAt(5)] },
				{ sourcePath: SOURCE_A, targetPath: TARGET, occurrences: [occurrenceAt(3)] },
			]),
		);
		const groupTitles = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
		// Model orders pairs by (source, target) path; the count pill renders inside the heading.
		expect(groupTitles).toEqual(["alpha → target1", "beta → target1"]);
	});

	it("WHEN an edge model has several pairs THEN the section count sums every pair's rows", () => {
		renderContent(
			edgeModel([
				{ sourcePath: SOURCE_A, targetPath: TARGET, occurrences: [occurrenceAt(3), occurrenceAt(5)] },
				{ sourcePath: SOURCE_B, targetPath: TARGET, occurrences: [occurrenceAt(7)] },
			]),
		);
		const section = screen.getByRole("region", { name: "Link occurrences" });
		expect(section.querySelector(".vicinity-graph-link-preview__count")?.textContent).toBe("3");
	});

	it("WHEN the model has no occurrences THEN the section shows its empty state", () => {
		renderContent(edgeModel([]));
		expect(screen.getByText("No link occurrences.")).toBeTruthy();
	});
});

describe("LinkPreviewContent row toggling", () => {
	it("WHEN a row is collapsed THEN it shows the short context", () => {
		renderContent(singlePairModel([3]));
		expect(screen.getByText("short@3")).toBeTruthy();
	});

	it("WHEN a collapsed row is clicked THEN it shows the expanded context inline", () => {
		renderContent(singlePairModel([3]));
		fireEvent.click(screen.getByText("short@3"));
		expect(screen.getByText("expanded@3")).toBeTruthy();
	});

	it("WHEN an expanded row is clicked again THEN it collapses back to the short context", () => {
		renderContent(singlePairModel([3]));
		fireEvent.click(screen.getByText("short@3"));
		fireEvent.click(screen.getByText("expanded@3"));
		expect(screen.getByText("short@3")).toBeTruthy();
	});

	it("WHEN one row toggles THEN sibling rows stay collapsed", () => {
		renderContent(singlePairModel([3, 5]));
		fireEvent.click(screen.getByText("short@3"));
		expect(screen.getByText("short@5")).toBeTruthy();
	});
});

describe("LinkPreviewContent bulk buttons", () => {
	/** Two rows across two pairs — bulk actions must span groups. */
	const twoPairModel = (): ReturnType<typeof LinkPreviewModels.edge> =>
		edgeModel([
			{ sourcePath: SOURCE_A, targetPath: TARGET, occurrences: [occurrenceAt(3)] },
			{ sourcePath: SOURCE_B, targetPath: TARGET, occurrences: [occurrenceAt(7)] },
		]);

	it("WHEN every row is collapsed THEN only Expand all is enabled", () => {
		renderContent(twoPairModel());
		expect([expandAll().hasAttribute("disabled"), collapseAll().hasAttribute("disabled")]).toEqual([false, true]);
	});

	it("WHEN Expand all is clicked THEN every row expands and only Collapse all is enabled", () => {
		renderContent(twoPairModel());
		fireEvent.click(expandAll());
		expect([expandAll().hasAttribute("disabled"), collapseAll().hasAttribute("disabled")]).toEqual([true, false]);
	});

	it("WHEN expansion is mixed THEN both buttons are enabled", () => {
		renderContent(twoPairModel());
		fireEvent.click(screen.getByText("short@3"));
		expect([expandAll().hasAttribute("disabled"), collapseAll().hasAttribute("disabled")]).toEqual([false, false]);
	});

	it("WHEN Expand all is clicked THEN every context row shows its expanded context", () => {
		renderContent(twoPairModel());
		fireEvent.click(expandAll());
		expect([screen.getByText("expanded@3"), screen.getByText("expanded@7")]).toHaveLength(2);
	});

	it("WHEN Collapse all follows Expand all THEN every row is collapsed again", () => {
		renderContent(twoPairModel());
		fireEvent.click(expandAll());
		fireEvent.click(collapseAll());
		expect(rowToggles().every((toggle) => toggle.getAttribute("aria-expanded") === "false")).toBe(true);
	});

	it("WHEN the model has zero context rows THEN both bulk buttons are disabled", () => {
		renderContent(edgeModel([]));
		expect([expandAll().hasAttribute("disabled"), collapseAll().hasAttribute("disabled")]).toEqual([true, true]);
	});
});

describe("LinkPreviewContent GO", () => {
	it("WHEN an edge-row GO is clicked THEN the payload targets the edge's SOURCE note", () => {
		const { goTargets } = renderContent(singlePairModel([9]));
		fireEvent.click(screen.getByRole("button", { name: "Go to line 10 in center" }));
		expect(goTargets).toEqual([{ path: NOTE, line: 9 }]);
	});

	it("WHEN a GO is clicked in a multi-pair edge preview THEN the payload targets THAT pair's source note", () => {
		const { goTargets } = renderContent(
			edgeModel([
				{ sourcePath: SOURCE_A, targetPath: TARGET, occurrences: [occurrenceAt(3)] },
				{ sourcePath: SOURCE_B, targetPath: TARGET, occurrences: [occurrenceAt(7)] },
			]),
		);
		fireEvent.click(screen.getByRole("button", { name: "Go to line 8 in beta" }));
		expect(goTargets).toEqual([{ path: SOURCE_B, line: 7 }]);
	});

	it("WHEN a GO is clicked THEN its row does NOT toggle", () => {
		renderContent(singlePairModel([3]));
		fireEvent.click(screen.getByRole("button", { name: "Go to line 4 in center" }));
		expect(screen.getByText("short@3")).toBeTruthy();
	});

	it("WHEN a GO icon renders THEN it comes from the renderIcon seam", () => {
		renderContent(singlePairModel([3]));
		const icon = screen
			.getByRole("button", { name: "Go to line 4 in center" })
			.querySelector("[data-icon-id]");
		expect(icon?.getAttribute("data-icon-id")).toBe(GO_ICON_ID);
	});
});

describe("LinkPreviewContent snippet markdown rendering", () => {
	/** Occurrence whose snippet holds a wiki link. */
	const linkedOccurrence: LinkOccurrence = {
		offset: 30,
		context: { shortContext: "see [[Wiki Target]]", expandedContext: "see [[Wiki Target]] and more", line: 3 },
	};
	const linkedModel = (): ReturnType<typeof LinkPreviewModels.edge> =>
		edgeModel([{ sourcePath: NOTE, targetPath: TARGET, occurrences: [linkedOccurrence] }]);

	it("WHEN a row snippet renders THEN it goes through the renderMarkdown seam against the containing note", () => {
		const { markdownCalls } = renderContent(singlePairModel([3]));
		expect(markdownCalls).toContainEqual({ markdown: "short@3", sourcePath: NOTE });
	});

	it("WHEN a row expands THEN the expanded snippet re-renders through the seam", () => {
		const { markdownCalls } = renderContent(singlePairModel([3]));
		fireEvent.click(screen.getByText("short@3"));
		expect(markdownCalls).toContainEqual({ markdown: "expanded@3", sourcePath: NOTE });
	});

	it("WHEN a rendered internal link is clicked THEN its linktext and the snippet's note reach onOpenLink", () => {
		const { openedLinks } = renderContent(linkedModel());
		fireEvent.click(screen.getByText("Wiki Target"));
		expect(openedLinks).toEqual([{ linktext: "Wiki Target", sourcePath: NOTE }]);
	});

	it("WHEN a rendered internal link is clicked THEN its row does NOT toggle", () => {
		renderContent(linkedModel());
		fireEvent.click(screen.getByText("Wiki Target"));
		expect(rowToggles().every((toggle) => toggle.getAttribute("aria-expanded") === "false")).toBe(true);
	});
});

describe("LinkPreviewContent fallback occurrences (no position)", () => {
	it("WHEN an occurrence has no context THEN its row shows the fallback copy without a GO button", () => {
		renderContent(singlePairModel([null]));
		expect([screen.getByText("No context available"), screen.queryByRole("button", { name: /^Go to line/ })]).toEqual(
			[expect.anything(), null],
		);
	});
});
