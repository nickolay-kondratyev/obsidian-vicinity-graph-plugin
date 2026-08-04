import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Drag-to-resize e2e (ticket nid_qjsj5mth2phdqctbm0vfx9elw_e), driven through
 * the real gesture: hover a node, drag its bottom-right resize handle, release.
 * Asserted end-to-end:
 * - the released box persists as the docid-keyed override in the plugin store;
 * - the rebuilt graph renders the node at EXACTLY the persisted box (React
 *   Flow's inline style is in flow units, so it equals the override verbatim,
 *   independent of zoom);
 * - the override survives a view remount AND a central switch (it is a global
 *   fact about the doc, like a pin);
 * - the context menu's "Reset size" clears it.
 *
 * SERIAL and order-dependent: each test builds on the state above it.
 */

test.describe.configure({ mode: "serial" });

/**
 * The resize target carries a seeded `id`: committing an override on an id-less
 * note would first WRITE frontmatter (Q5 silent-assign) — real behavior, but
 * seeding keeps the docid deterministic for the store assertions below.
 */
const SCENARIO_FIXTURES: Record<string, string> = {
	"rz_hub.md": "Resize MAIN — links out to [[rz_target]].\n",
	"rz_target.md": "---\nid: docid_resizetarget_e\n---\nThe node being resized.\n",
	"rz_other.md": "Second MAIN — also links out to [[rz_target]].\n",
};

const HUB = "rz_hub.md";
const OTHER_MAIN = "rz_other.md";
const TARGET = "rz_target.md";
const TARGET_DOCID = "docid_resizetarget_e";

/** Screen-pixel drag deltas — large enough that ANY fitted zoom yields clear growth. */
const DRAG_DELTA_X_PX = 90;
const DRAG_DELTA_Y_PX = 60;

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: SCENARIO_FIXTURES });
	page = harness.page;
	await harness.openFile(HUB);
	await harness.openGraphView();
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string): Locator {
	return page.locator(`.vicinity-graph-node[data-path="${path}"]`);
}

/** React Flow's node wrapper — its inline style width/height are FLOW units (zoom-independent). */
function flowNodeWrapper(path: string): Locator {
	return page.locator(`.react-flow__node[data-id="${path}"]`);
}

async function renderedBoxPx(path: string): Promise<{ widthPx: number; heightPx: number }> {
	return flowNodeWrapper(path).evaluate((el) => ({
		widthPx: Number.parseFloat((el as HTMLElement).style.width),
		heightPx: Number.parseFloat((el as HTMLElement).style.height),
	}));
}

/**
 * The bottom-right corner grip. Located under the React Flow node WRAPPER, not
 * under `.vicinity-graph-node`: the grip overhangs the node box, and that box
 * clips its content (`overflow: hidden`), so the grips are mounted outside it.
 */
function cornerResizeHandle(path: string): Locator {
	return flowNodeWrapper(path).locator(".react-flow__resize-control.handle.bottom.right");
}

/** Hover-reveals the bottom-right handle, then drags it by the given screen deltas. */
async function dragResizeHandle(path: string, deltaX: number, deltaY: number): Promise<void> {
	const node = noteNode(path);
	await node.hover();
	const handle = cornerResizeHandle(path);
	await expect(handle).toBeVisible();
	// hover() (not raw mouse.move to the box centre): Playwright's actionability
	// hit-check is what reliably lands the pointer ON the handle before the press.
	await handle.hover();
	// Measured AFTER the hover, so the deltas below are applied to the box the
	// pointer is actually resting in (hover can settle the graph's layout).
	const box = await handle.boundingBox();
	if (box === null) {
		throw new Error("resize handle has no bounding box");
	}
	const startX = box.x + box.width / 2;
	const startY = box.y + box.height / 2;
	await page.mouse.down();
	// Stepped move: XYResizer listens to pointermove, one jump can be swallowed.
	await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
	await page.mouse.up();
}

test("WHEN a node's corner handle is dragged and released THEN the box persists as the doc's override and renders verbatim", async () => {
	await expect(noteNode(TARGET)).toBeVisible();
	const before = await renderedBoxPx(TARGET);

	await dragResizeHandle(TARGET, DRAG_DELTA_X_PX, DRAG_DELTA_Y_PX);

	// Commit-on-release: the override lands in the store...
	await expect
		.poll(async () => (await harness.readNodeOverrides())[TARGET_DOCID]?.sizePx !== undefined)
		.toBe(true);
	const override = (await harness.readNodeOverrides())[TARGET_DOCID]?.sizePx;
	if (override === undefined) {
		throw new Error("override vanished between polls");
	}
	expect(override.widthPx).toBeGreaterThan(before.widthPx);
	expect(override.heightPx).toBeGreaterThan(before.heightPx);
	// ...and the ONE rebuild renders the node at exactly the persisted box.
	await expect.poll(() => renderedBoxPx(TARGET)).toEqual({
		widthPx: override.widthPx,
		heightPx: override.heightPx,
	});
});

test("WHEN the graph view is remounted THEN the resized node reopens at its overridden box", async () => {
	const override = (await harness.readNodeOverrides())[TARGET_DOCID]?.sizePx;
	if (override === undefined) {
		throw new Error("GIVEN violated: no stored override from the previous test");
	}
	await harness.remountGraphView();
	await expect(noteNode(TARGET)).toBeVisible();
	await expect.poll(() => renderedBoxPx(TARGET)).toEqual({
		widthPx: override.widthPx,
		heightPx: override.heightPx,
	});
});

test("WHEN the central switches to another note THEN the override still applies (global by docid, not per-view)", async () => {
	const override = (await harness.readNodeOverrides())[TARGET_DOCID]?.sizePx;
	if (override === undefined) {
		throw new Error("GIVEN violated: no stored override from the previous tests");
	}
	await harness.openFile(OTHER_MAIN);
	await expect(noteNode(OTHER_MAIN)).toHaveAttribute("data-tier", "main");
	await expect.poll(() => renderedBoxPx(TARGET)).toEqual({
		widthPx: override.widthPx,
		heightPx: override.heightPx,
	});
});

test("WHEN 'Reset size' is chosen from the node's context menu THEN the override is cleared and the computed box returns", async () => {
	const overridden = await renderedBoxPx(TARGET);
	await noteNode(TARGET).click({ button: "right" });
	await page.locator(".menu .menu-item", { hasText: "Reset size" }).click();
	await expect.poll(async () => (await harness.readNodeOverrides())[TARGET_DOCID]).toBeUndefined();
	// The rebuilt box is the computed one again — different from the dragged box.
	await expect.poll(async () => (await renderedBoxPx(TARGET)).widthPx).not.toBe(overridden.widthPx);
});

test("WHEN the corner grip's OVERHANGING half is hit-tested THEN it is the grip, not the pane", async () => {
	// The grip is centred ON the node's corner, so half of it hangs outside the
	// node box. `.vicinity-graph-node` is `overflow: hidden` — mounting the grips
	// inside it clips exactly this half away, shrinking a 9px chip to a ~4px nub
	// and the 1px edge lines to a half-pixel sliver. Probed through the real hit
	// test because the clip changes neither the element's box nor its styles.
	await noteNode(TARGET).hover();
	const grip = await cornerResizeHandle(TARGET).boundingBox();
	if (grip === null) {
		throw new Error("corner resize grip has no bounding box");
	}
	const hit = await page.evaluate(
		(point) => document.elementFromPoint(point.x, point.y)?.className ?? "",
		{ x: grip.x + grip.width * 0.75, y: grip.y + grip.height * 0.75 },
	);
	expect(hit).toContain("react-flow__resize-control");
});

test("WHEN the corner grip is pressed and released without moving THEN the note is neither resized nor focused", async () => {
	await noteNode(TARGET).hover();
	await cornerResizeHandle(TARGET).hover();
	await page.mouse.down();
	await page.mouse.up();
	// A press that never moved is no resize (XYResizer reports no end), and a grip
	// is a control, not the node's body — so it must not focus/open the note. The
	// forced refresh drains the rebuild queue, so a focus that DID happen shows up.
	await harness.refreshOpenViews();
	expect(await harness.readNodeOverrides()).toEqual({});
	await expect(noteNode(OTHER_MAIN)).toHaveAttribute("data-tier", "main");
	await expect(noteNode(TARGET)).not.toHaveAttribute("data-tier", "main");
});
