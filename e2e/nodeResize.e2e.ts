import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { EngineDefaults, NODE_OVERRIDE_HARD_MIN_PX } from "../src/engine";
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
 * - the context menu's "Reset size" clears it;
 * - each grip is REACHABLE by a real pointer (the corner chip's overhanging
 *   half, and the right edge's grab band — both are geometry no unit test can
 *   see, and both have shipped broken once);
 * - the gesture's seam into React Flow stays narrow: no node ends up SELECTED.
 *
 * The override is ALSO this suite's way of putting a node at a chosen box, which
 * is why the hover pin chip's small-node behavior is asserted here (ticket
 * `nid_tclb98q9hxhmcuonamvr4ig1f_e`): the chip is revealed at every node height
 * and only withheld where it would cover the node's CENTRE point, and the sizes
 * that band applies to are not sizes a fixture graph renders on its own.
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

/** The smallest box content-fit sizing produces at shipped dials — the COMMON small node. */
const SHIPPED_MIN_NODE_PX = EngineDefaults.sizingSettings().minPx;

/**
 * A width no chip rung can reach — the shipped `maxPx`, so the node under it is
 * "small" on its HEIGHT axis only: the title-only note the pin chip's default size
 * exists for (ticket nid_8i5936g90vrllosssaz7v3xbr_e).
 */
const WIDE_NODE_WIDTH_PX = EngineDefaults.sizingSettings().maxPx;

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
 * Every rendered React Flow node's placement, keyed by id. Read off the inline
 * `transform` — React Flow writes each node's FLOW-unit position there, so this
 * is the layout's own output, unaffected by pan/zoom.
 */
async function flowNodePositions(): Promise<Record<string, string>> {
	return page.evaluate(() =>
		Object.fromEntries(
			Array.from(document.querySelectorAll<HTMLElement>(".react-flow__node")).map((el) => [
				el.dataset["id"] ?? "",
				el.style.transform,
			]),
		),
	);
}

/**
 * React Flow's pane transform — the user's pan and zoom, verbatim. `fitView`
 * rewrites it, so an unchanged string is proof that NO refit ran.
 */
async function viewportTransform(): Promise<string> {
	return page.locator(".react-flow__viewport").evaluate((el) => (el as HTMLElement).style.transform);
}

/**
 * The bottom-right corner grip. Located under the React Flow node WRAPPER, not
 * under `.vicinity-graph-node`: the grip overhangs the node box, and that box
 * clips its content (`overflow: hidden`), so the grips are mounted outside it.
 */
function cornerResizeHandle(path: string): Locator {
	return flowNodeWrapper(path).locator(".react-flow__resize-control.handle.bottom.right");
}

/**
 * An EDGE grip (the right or bottom grab band). A band, not React Flow's stock
 * 1px hairline: the plugin widens it in CSS, and `hover()` below is what proves
 * a real pointer can land on it — a hairline fails the actionability hit-check.
 */
function edgeResizeLine(path: string, side: "right" | "bottom"): Locator {
	return flowNodeWrapper(path).locator(`.react-flow__resize-control.line.${side}`);
}

/** Hover-reveals the node's grips, then drags `grip` by the given screen deltas. */
async function dragGrip(path: string, grip: Locator, deltaX: number, deltaY: number): Promise<void> {
	await noteNode(path).hover();
	await expect(grip).toBeVisible();
	// hover() (not raw mouse.move to the box centre): Playwright's actionability
	// hit-check is what reliably lands the pointer ON the grip before the press.
	await grip.hover();
	// Measured AFTER the hover, so the deltas below are applied to the box the
	// pointer is actually resting in (hover can settle the graph's layout).
	const box = await grip.boundingBox();
	if (box === null) {
		throw new Error("resize grip has no bounding box");
	}
	const startX = box.x + box.width / 2;
	const startY = box.y + box.height / 2;
	await page.mouse.down();
	// Stepped move: XYResizer listens to pointermove, one jump can be swallowed.
	await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
	await page.mouse.up();
}

/** Hover-reveals the bottom-right handle, then drags it by the given screen deltas. */
async function dragResizeHandle(path: string, deltaX: number, deltaY: number): Promise<void> {
	await dragGrip(path, cornerResizeHandle(path), deltaX, deltaY);
}

/** The doc's stored size override, or a thrown GIVEN violation if it is not there. */
async function storedOverrideSizePx(): Promise<{ widthPx: number; heightPx: number }> {
	const sizePx = (await harness.readNodeOverrides())[TARGET_DOCID]?.sizePx;
	if (sizePx === undefined) {
		throw new Error("no stored size override for the resize target");
	}
	return sizePx;
}

test("WHEN a node's corner handle is dragged and released THEN the box persists as the doc's override and renders verbatim", async () => {
	await expect(noteNode(TARGET)).toBeVisible();
	const before = await renderedBoxPx(TARGET);

	await dragResizeHandle(TARGET, DRAG_DELTA_X_PX, DRAG_DELTA_Y_PX);

	// Commit-on-release: the override lands in the store...
	await expect
		.poll(async () => (await harness.readNodeOverrides())[TARGET_DOCID]?.sizePx !== undefined)
		.toBe(true);
	const override = await storedOverrideSizePx();
	expect(override.widthPx).toBeGreaterThan(before.widthPx);
	expect(override.heightPx).toBeGreaterThan(before.heightPx);
	// ...and the ONE rebuild renders the node at exactly the persisted box.
	await expect.poll(() => renderedBoxPx(TARGET)).toEqual({
		widthPx: override.widthPx,
		heightPx: override.heightPx,
	});
});

test("WHEN the graph view is remounted THEN the resized node reopens at its overridden box", async () => {
	const override = await storedOverrideSizePx();
	await harness.remountGraphView();
	await expect(noteNode(TARGET)).toBeVisible();
	await expect.poll(() => renderedBoxPx(TARGET)).toEqual({
		widthPx: override.widthPx,
		heightPx: override.heightPx,
	});
});

test("WHEN the central switches to another note THEN the override still applies (global by docid, not per-view)", async () => {
	const override = await storedOverrideSizePx();
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

test("WHEN a node is clicked THEN React Flow leaves NO node selected (the graph is read-only)", async () => {
	// The resize commit made <ReactFlow> apply onNodesChange, which is also how RF
	// would write its own SELECTION into the controller-owned node state — an
	// accent ring the graph never asked for, on a graph whose only selection-like
	// state is the MAIN tier. Clicking the CURRENT main is the sharp probe: it is
	// the one click that triggers no rebuild, so a selection STICKS instead of
	// being washed away by the next publish — asserted with NO refresh in between
	// for exactly that reason.
	await noteNode(OTHER_MAIN).click();
	expect(await page.locator(".react-flow__node.selected").count()).toBe(0);
});

test("WHEN the RIGHT edge line is dragged THEN the width alone grows (the line is a grabbable band)", async () => {
	// React Flow's stock line control is a 1px-wide box — 1 FLOW pixel, so a
	// fraction of a screen pixel at any zoom below 1, and unhittable in practice.
	// `dragGrip`'s hover() is the proof: it fails the actionability hit-check
	// unless a real pointer can land on the band.
	const before = await renderedBoxPx(TARGET);
	await dragGrip(TARGET, edgeResizeLine(TARGET, "right"), DRAG_DELTA_X_PX, 0);
	await expect.poll(async () => (await harness.readNodeOverrides())[TARGET_DOCID]?.sizePx).toBeDefined();
	const override = await storedOverrideSizePx();
	expect({ widerThanBefore: override.widthPx > before.widthPx, heightPx: override.heightPx }).toEqual({
		widerThanBefore: true,
		heightPx: Math.round(before.heightPx),
	});
});

test("WHEN a committed resize still FITS where the node sits THEN neither the other nodes nor the viewport move", async () => {
	// Ticket nid_9ep12hkmk4zjv2p28emmrhieq_e: a resize used to re-run the layout
	// unconditionally, re-arranging (and re-fitting) a graph that was fine. A SHRINK
	// is the deterministic probe — a smaller box can collide with nothing, so the
	// reuse path MUST be taken and every other node must keep its exact position.
	//
	// The viewport half is ticket nid_ct22qotgtw4rezbdn5m0diyb3_e: only a FRESH elk
	// layout bumps `layoutVersion`, and only that re-runs `fitView`. Probed from a
	// zoom the user made themselves — a refit would snap that framing away, so an
	// unchanged pane transform is the assertion that the framing survives. Wheel,
	// not a drag: a press-move-release on the pane can land as a CLICK on a node
	// (which opens it and switches the central), and this test must change nothing
	// but the framing.
	await noteNode(TARGET).hover();
	const framingBeforeZoom = await viewportTransform();
	await page.mouse.wheel(0, -120);
	// GIVEN violation if the zoom never took: the probe below would then be
	// comparing the FITTED framing against itself and could not fail.
	await expect.poll(viewportTransform).not.toBe(framingBeforeZoom);
	const before = await flowNodePositions();
	const viewportBefore = await viewportTransform();
	const storedBefore = await storedOverrideSizePx();

	await dragResizeHandle(TARGET, -DRAG_DELTA_X_PX, -DRAG_DELTA_Y_PX);

	// Wait for the rebuild the release triggers to have PUBLISHED the smaller box...
	await expect.poll(async () => (await storedOverrideSizePx()).widthPx).toBeLessThan(storedBefore.widthPx);
	await expect.poll(async () => (await renderedBoxPx(TARGET)).widthPx).toBe(
		(await storedOverrideSizePx()).widthPx,
	);
	// ...then nothing but the resized node may have moved — neither its neighbours
	// (no relayout) nor the user's framing (no refit).
	const after = await flowNodePositions();
	delete before[TARGET];
	delete after[TARGET];
	expect({ positions: after, framing: await viewportTransform() }).toEqual({
		positions: before,
		framing: viewportBefore,
	});
});

// --- the hover pin chip on a SMALL node (nid_tclb98q9hxhmcuonamvr4ig1f_e) ----

/**
 * Puts the target on screen as an ordinary NEIGHBOUR at exactly `sidePx` square,
 * through the real store-override → rebuild path (a drag's deltas are screen
 * pixels against an unknown zoom, so it cannot name an exact box).
 *
 * Neighbour, not MAIN: a central carries the 2px accent ring, so at the SAME box
 * it has 2px LESS content for the chip's container query to measure — the
 * ordinary node is the tight case, and it is also the one whose click must open
 * the note rather than being a no-op re-centre on itself.
 */
async function renderTargetAsNeighbourAt(sidePx: number): Promise<void> {
	await renderTargetAsNeighbourBox({ widthPx: sidePx, heightPx: sidePx });
}

/** The same, at a box that need not be square — the chip's rungs read BOTH axes. */
async function renderTargetAsNeighbourBox(box: { widthPx: number; heightPx: number }): Promise<void> {
	await harness.openFile(HUB);
	// The active file is the INPUT the next rebuild reads, so settle it before
	// writing. WHY-NOT also wait on `HUB` rendering as `data-tier=main` as PROOF a
	// HUB-centred rebuild landed: HUB is MAIN both BEFORE and AFTER the predecessor
	// test re-centres on the TARGET (that rebuild can still be in flight, and a
	// superseded one never publishes), so the attribute is satisfied by the STALE
	// screen and the wait proves nothing. The rendered box below is the only
	// honest settle point — it is the thing this helper promises.
	await expect.poll(activeFilePath).toBe(HUB);
	await harness.saveNodeSizeOverride(TARGET_DOCID, box);
	// Split the two halves of this helper so a failure is LEGIBLE (ticket
	// nid_g1f5tjmxzr0hbfdeujvgwywsd_e): assert the WRITE landed in the store BEFORE
	// polling the rendered box. A store that already holds `box` here means a later
	// failure of the render poll can only be a lost REPAINT, not a lost write — the
	// full-suite flake this guards used to read the PREVIOUS test's box for 15s with
	// no way to tell which half was stale. The store keeps the box verbatim
	// (`clampNodeSizeOverridePx` only bounds 24..1200), so an exact match is right.
	await expect
		.poll(async () => (await harness.readNodeOverrides())[TARGET_DOCID]?.sizePx)
		.toEqual(box);
	// The SAME in-place fan-out the production write pipeline runs — no remount.
	// This once had to remount because an in-place fan-out could be swallowed: with
	// a graph already rendered, React Flow's ResizeObserver re-measured the node's
	// pre-reseed DOM and fed the PREVIOUS box straight back into local state,
	// clobbering the publish (ticket `nid_c78k90su87jrzigxvfjv5t95g_e`). That is
	// fixed — `onNodesChange` now folds in only resize-GESTURE dimension changes —
	// so this helper exercises the real fan-out, the way production does.
	await harness.refreshOpenViews();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");
	await expect.poll(() => renderedBoxPx(TARGET)).toEqual(box);
}

/** One computed style value off the node's pin chip — the rung the CASCADE picked. */
async function pinChipComputedStyle(path: string, property: "display" | "width" | "height"): Promise<string> {
	return noteNode(path)
		.locator(".vicinity-graph-pin-button")
		.evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property);
}

/**
 * The chip's COMPUTED display. `flex`, not the authored `inline-flex`: the chip
 * is absolutely positioned, and CSS blockifies an out-of-flow box's display.
 * `none` is the stylesheet WITHHOLDING it (the centre-clearance rung).
 */
async function pinChipDisplay(path: string): Promise<string> {
	return pinChipComputedStyle(path, "display");
}

/**
 * The chip's RENDERED box, as the browser RESOLVED it — which is the rung the
 * container queries actually applied, not what the stylesheet authored.
 *
 * Computed `width`/`height`, NOT `getBoundingClientRect()`: React Flow scales the
 * whole pane by the current fitted zoom, and a rect is that scaling applied to
 * translated corner points, so two chips of the identical CSS size can differ in
 * the last bits of a double — an exact `toEqual` between two nodes would then flake
 * on nothing. The computed value is the used length in CSS px, transform-free, so
 * the comparison this asks for ("one chip size throughout") is exact.
 */
async function pinChipBoxPx(path: string): Promise<{ widthPx: number; heightPx: number }> {
	return {
		widthPx: parsedComputedPx(await pinChipComputedStyle(path, "width"), `${path} chip width`),
		heightPx: parsedComputedPx(await pinChipComputedStyle(path, "height"), `${path} chip height`),
	};
}

/** A resolved CSS length. Thrown on, never NaN-propagated into an assertion. */
function parsedComputedPx(value: string, subject: string): number {
	const px = Number.parseFloat(value);
	if (!Number.isFinite(px)) {
		throw new Error(`${subject} did not resolve to a px length: [${value}]`);
	}
	return px;
}

const activeFilePath = () =>
	page.evaluate(() => (window as unknown as { app: any }).app.workspace.getActiveFile()?.path);

test("WHEN a node renders at the shipped minimum THEN it still carries the hover pin chip", async () => {
	// The whole point of the ticket: content-fit sizing made this the COMMON node,
	// and the old 72px display gate left it with no pin affordance but the menu.
	await renderTargetAsNeighbourAt(SHIPPED_MIN_NODE_PX);
	expect(await pinChipDisplay(TARGET)).toBe("flex");
});

test("WHEN that minimum-sized node's body is clicked THEN the note opens (the compact chip does not swallow it)", async () => {
	// The invariant the compact rung exists for. Playwright's own hover REVEALS the
	// chip on the way to the click, so a chip reaching the centre point would stop
	// propagation here and the active file would never change.
	await renderTargetAsNeighbourAt(SHIPPED_MIN_NODE_PX);
	await noteNode(TARGET).click();
	await expect.poll(activeFilePath).toBe(TARGET);
});

// --- one chip size throughout (nid_8i5936g90vrllosssaz7v3xbr_e) --------------

test("WHEN a node is short but WIDE THEN its pin chip is the same size as a large node's", async () => {
	// The ticket: the common small node is a title-only note — minPx TALL but as wide
	// as its title — and the old ladder grew the chip on HEIGHT alone, so that node
	// wore the tiny chip with its corner half empty. The MAIN hub is the large node
	// to match; comparing the two RESOLVED chips (rather than a px literal from the
	// stylesheet) is the "same size throughout" claim itself.
	await renderTargetAsNeighbourBox({ widthPx: WIDE_NODE_WIDTH_PX, heightPx: SHIPPED_MIN_NODE_PX });
	expect(await pinChipBoxPx(TARGET)).toEqual(await pinChipBoxPx(HUB));
});

test("WHEN a node is small on BOTH axes THEN its chip steps down, so the node stays clickable", async () => {
	// The other half, and what keeps the test above from passing on a stylesheet that
	// simply shrank every chip: the step-down still fires where the full-size chip
	// would cover the node's centre point.
	await renderTargetAsNeighbourAt(SHIPPED_MIN_NODE_PX);
	const compact = await pinChipBoxPx(TARGET);
	expect(compact.heightPx).toBeLessThan((await pinChipBoxPx(HUB)).heightPx);
});

test("WHEN a node is shrunk to the drag-resize floor THEN the chip that would cover its centre is withheld", async () => {
	// The one band where "every node carries the chip" yields. Only a real engine
	// answers this: nodeDensityThresholds.test.ts proves the rung's arithmetic
	// against the stylesheet, but not that Chromium PARSES a two-axis
	// `@container … and …` prelude — an unparsable one is dropped SILENTLY.
	await renderTargetAsNeighbourAt(NODE_OVERRIDE_HARD_MIN_PX);
	expect(await pinChipDisplay(TARGET)).toBe("none");
});

test("WHEN that floor-sized node's body is clicked THEN the note still opens", async () => {
	await renderTargetAsNeighbourAt(NODE_OVERRIDE_HARD_MIN_PX);
	await noteNode(TARGET).click();
	await expect.poll(activeFilePath).toBe(TARGET);
});
