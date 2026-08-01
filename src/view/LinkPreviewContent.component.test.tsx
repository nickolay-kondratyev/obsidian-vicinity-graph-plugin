// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BacklinkSourceOccurrences, LinkOccurrence, OutgoingLinkOccurrence } from "../engine";
import { asVaultPath } from "../engine";
import type { LinkPreviewGoTarget } from "./LinkPreviewContent";
import { GO_ICON_ID, LinkPreviewContent } from "./LinkPreviewContent";
import { LinkPreviewModels } from "./linkPreviewModel";

/**
 * RENDERED behaviour of the link-preview modal content: row toggling, bulk
 * button enablement, GO payloads, fallback rows, empty states. Driven through
 * plain recording fakes of the two function ports — the modal shell itself is
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

function outgoingAt(line: number | null): OutgoingLinkOccurrence {
	return { ...occurrenceAt(line), targetPath: TARGET };
}

function backlinksFrom(sourcePath: string, lines: readonly (number | null)[]): BacklinkSourceOccurrences {
	return { sourcePath: asVaultPath(sourcePath), occurrences: lines.map(occurrenceAt) };
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

function nodeModel(
	overrides: Partial<Parameters<typeof LinkPreviewModels.node>[0]> = {},
): ReturnType<typeof LinkPreviewModels.node> {
	return LinkPreviewModels.node({
		path: NOTE,
		outline: [{ rawText: "# Alpha", level: 1 }],
		outgoing: [outgoingAt(3)],
		backlinks: [backlinksFrom(SOURCE_A, [7])],
		...overrides,
	});
}

const expandAll = (): HTMLElement => screen.getByRole("button", { name: "Expand all" });
const collapseAll = (): HTMLElement => screen.getByRole("button", { name: "Collapse all" });
/** Every context-row toggle, in display order. */
const rowToggles = (): HTMLElement[] =>
	screen.queryAllByRole("button", { expanded: false }).concat(screen.queryAllByRole("button", { expanded: true }));

afterEach(cleanup);

describe("LinkPreviewContent sections", () => {
	it("WHEN a node model renders THEN Outline, Links and Backlinks sections appear in that order", () => {
		renderContent(nodeModel());
		const titles = screen
			.getAllByRole("region")
			.map((section) => section.getAttribute("aria-label"));
		expect(titles).toEqual(["Outline", "Links", "Backlinks"]);
	});

	it("WHEN a node model renders THEN each backlink group is headed by its source note title", () => {
		renderContent(nodeModel({ backlinks: [backlinksFrom(SOURCE_B, [2]), backlinksFrom(SOURCE_A, [7])] }));
		const groupTitles = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
		// Model orders groups by source path; the count pill renders inside the heading.
		expect(groupTitles).toEqual(["alpha1", "beta1"]);
	});

	it("WHEN an edge model renders THEN only the single occurrences section appears", () => {
		renderContent(LinkPreviewModels.edge({ sourcePath: NOTE, targetPath: TARGET, occurrences: [occurrenceAt(3)] }));
		const titles = screen.getAllByRole("region").map((section) => section.getAttribute("aria-label"));
		expect(titles).toEqual(["Link occurrences"]);
	});

	it("WHEN the outline renders THEN heading labels are formatted, not raw markdown", () => {
		renderContent(nodeModel({ outline: [{ rawText: "## The **Plan**", level: 2 }] }));
		expect(screen.getByText("The Plan")).toBeTruthy();
	});

	it("WHEN a node has no backlinks THEN the Backlinks section shows its empty state", () => {
		renderContent(nodeModel({ backlinks: [] }));
		expect(screen.getByText("No backlinks.")).toBeTruthy();
	});
});

describe("LinkPreviewContent row toggling", () => {
	it("WHEN a row is collapsed THEN it shows the short context", () => {
		renderContent(nodeModel({ backlinks: [] }));
		expect(screen.getByText("short@3")).toBeTruthy();
	});

	it("WHEN a collapsed row is clicked THEN it shows the expanded context inline", () => {
		renderContent(nodeModel({ backlinks: [] }));
		fireEvent.click(screen.getByText("short@3"));
		expect(screen.getByText("expanded@3")).toBeTruthy();
	});

	it("WHEN an expanded row is clicked again THEN it collapses back to the short context", () => {
		renderContent(nodeModel({ backlinks: [] }));
		fireEvent.click(screen.getByText("short@3"));
		fireEvent.click(screen.getByText("expanded@3"));
		expect(screen.getByText("short@3")).toBeTruthy();
	});

	it("WHEN one row toggles THEN sibling rows stay collapsed", () => {
		renderContent(nodeModel({ outgoing: [outgoingAt(3), outgoingAt(5)], backlinks: [] }));
		fireEvent.click(screen.getByText("short@3"));
		expect(screen.getByText("short@5")).toBeTruthy();
	});
});

describe("LinkPreviewContent bulk buttons", () => {
	it("WHEN every row is collapsed THEN only Expand all is enabled", () => {
		renderContent(nodeModel());
		expect([expandAll().hasAttribute("disabled"), collapseAll().hasAttribute("disabled")]).toEqual([false, true]);
	});

	it("WHEN Expand all is clicked THEN every row expands and only Collapse all is enabled", () => {
		renderContent(nodeModel());
		fireEvent.click(expandAll());
		expect([expandAll().hasAttribute("disabled"), collapseAll().hasAttribute("disabled")]).toEqual([true, false]);
	});

	it("WHEN expansion is mixed THEN both buttons are enabled", () => {
		renderContent(nodeModel());
		fireEvent.click(screen.getByText("short@3"));
		expect([expandAll().hasAttribute("disabled"), collapseAll().hasAttribute("disabled")]).toEqual([false, false]);
	});

	it("WHEN Expand all is clicked THEN every context row shows its expanded context", () => {
		renderContent(nodeModel());
		fireEvent.click(expandAll());
		expect([screen.getByText("expanded@3"), screen.getByText("expanded@7")]).toHaveLength(2);
	});

	it("WHEN Collapse all follows Expand all THEN every row is collapsed again", () => {
		renderContent(nodeModel());
		fireEvent.click(expandAll());
		fireEvent.click(collapseAll());
		expect(rowToggles().every((toggle) => toggle.getAttribute("aria-expanded") === "false")).toBe(true);
	});

	it("WHEN the model has zero context rows THEN both bulk buttons are disabled", () => {
		renderContent(nodeModel({ outgoing: [], backlinks: [] }));
		expect([expandAll().hasAttribute("disabled"), collapseAll().hasAttribute("disabled")]).toEqual([true, true]);
	});
});

describe("LinkPreviewContent GO", () => {
	it("WHEN a Links-row GO is clicked THEN the payload targets the clicked note at the occurrence line", () => {
		const { goTargets } = renderContent(nodeModel({ backlinks: [] }));
		fireEvent.click(screen.getByRole("button", { name: "Go to line 4 in center" }));
		expect(goTargets).toEqual([{ path: NOTE, line: 3 }]);
	});

	it("WHEN a backlink-row GO is clicked THEN the payload targets the SOURCE note at the occurrence line", () => {
		const { goTargets } = renderContent(nodeModel({ outgoing: [] }));
		fireEvent.click(screen.getByRole("button", { name: "Go to line 8 in alpha" }));
		expect(goTargets).toEqual([{ path: SOURCE_A, line: 7 }]);
	});

	it("WHEN an edge-row GO is clicked THEN the payload targets the edge's SOURCE note", () => {
		const { goTargets } = renderContent(
			LinkPreviewModels.edge({ sourcePath: NOTE, targetPath: TARGET, occurrences: [occurrenceAt(9)] }),
		);
		fireEvent.click(screen.getByRole("button", { name: "Go to line 10 in center" }));
		expect(goTargets).toEqual([{ path: NOTE, line: 9 }]);
	});

	it("WHEN a GO is clicked THEN its row does NOT toggle", () => {
		renderContent(nodeModel({ backlinks: [] }));
		fireEvent.click(screen.getByRole("button", { name: "Go to line 4 in center" }));
		expect(screen.getByText("short@3")).toBeTruthy();
	});

	it("WHEN a GO icon renders THEN it comes from the renderIcon seam", () => {
		renderContent(nodeModel({ backlinks: [] }));
		const icon = screen
			.getByRole("button", { name: "Go to line 4 in center" })
			.querySelector("[data-icon-id]");
		expect(icon?.getAttribute("data-icon-id")).toBe(GO_ICON_ID);
	});
});

describe("LinkPreviewContent snippet markdown rendering", () => {
	/** Outgoing occurrence whose snippet holds a wiki link. */
	const linkedOutgoing: OutgoingLinkOccurrence = {
		targetPath: TARGET,
		offset: 30,
		context: { shortContext: "see [[Wiki Target]]", expandedContext: "see [[Wiki Target]] and more", line: 3 },
	};

	it("WHEN a Links-row snippet renders THEN it goes through the renderMarkdown seam against the containing note", () => {
		const { markdownCalls } = renderContent(nodeModel({ backlinks: [] }));
		expect(markdownCalls).toContainEqual({ markdown: "short@3", sourcePath: NOTE });
	});

	it("WHEN a backlink-row snippet renders THEN its sourcePath is the backlink SOURCE note", () => {
		const { markdownCalls } = renderContent(nodeModel({ outgoing: [] }));
		expect(markdownCalls).toContainEqual({ markdown: "short@7", sourcePath: SOURCE_A });
	});

	it("WHEN a row expands THEN the expanded snippet re-renders through the seam", () => {
		const { markdownCalls } = renderContent(nodeModel({ backlinks: [] }));
		fireEvent.click(screen.getByText("short@3"));
		expect(markdownCalls).toContainEqual({ markdown: "expanded@3", sourcePath: NOTE });
	});

	it("WHEN a rendered internal link is clicked THEN its linktext and the snippet's note reach onOpenLink", () => {
		const { openedLinks } = renderContent(nodeModel({ outgoing: [linkedOutgoing], backlinks: [] }));
		fireEvent.click(screen.getByText("Wiki Target"));
		expect(openedLinks).toEqual([{ linktext: "Wiki Target", sourcePath: NOTE }]);
	});

	it("WHEN a rendered internal link is clicked THEN its row does NOT toggle", () => {
		renderContent(nodeModel({ outgoing: [linkedOutgoing], backlinks: [] }));
		fireEvent.click(screen.getByText("Wiki Target"));
		expect(rowToggles().every((toggle) => toggle.getAttribute("aria-expanded") === "false")).toBe(true);
	});
});

describe("LinkPreviewContent fallback occurrences (no position)", () => {
	it("WHEN an occurrence has no context THEN its row shows the fallback copy without a GO button", () => {
		renderContent(nodeModel({ outgoing: [outgoingAt(null)], backlinks: [] }));
		expect([screen.getByText("No context available"), screen.queryByRole("button", { name: /^Go to line/ })]).toEqual(
			[expect.anything(), null],
		);
	});
});
