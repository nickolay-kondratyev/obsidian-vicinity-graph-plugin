import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * Step-06 RESTART round-trip (QA §1/§6/§11/§13) — the step's hard exit criterion
 * and the one thing the unit suite structurally cannot reach. Mutate the global
 * depth stepper, a pin, a sizing weight and the node cap through the real UI/store, do
 * ONE real Obsidian restart via {@link ObsidianHarness.relaunch}, then assert each
 * reloaded from `data.json`.
 *
 * Fixtures are e2e-only, ROOT-level (no folder groups to intercept pointer events)
 * and SPARSE — `rt_hub` has one outgoing neighbour and one incoming chain — so
 * `fitView` keeps nodes clear of the top-left controls panel and the pin gesture
 * stays deterministic. Its own dedicated vault copy makes it independent of the
 * scenario spec's pins.
 */

test.describe.configure({ mode: "serial" });

/**
 * The MAIN hub and the pin target carry a seeded `id` (obsidian-id-lib's
 * frontmatter key): a note can only be PINNED once it has a stable docid.
 * Seeding models the normal steady state and avoids an id-minting frontmatter
 * write on pin.
 *
 * The pin target carries three headings: content-fit sizing gives a bare
 * one-line note ~minPx (40px), far below the hover pin chip's 72px CONTENT-box
 * container threshold (`graph-view.css` — border-box 90px after the node's
 * padding+border). An outline-bearing node is floored at the preview reveal
 * instead — 122px border-box (104px content) — so `clickPin` stays a plain
 * hover-and-click.
 */
const RESTART_FIXTURES: Record<string, string> = {
	"rt_hub.md": "---\nid: docid_restarthub_e\n---\nRestart MAIN — links out to [[rt_x]].\n",
	"rt_x.md": "---\nid: docid_restartx_e\n---\nPin target — links out to [[rt_x1]].\n\n# Alpha\n\n## Beta\n\n## Gamma\n",
	"rt_x1.md": "Chain leaf.\n",
	"rt_in1.md": "Incoming hop 1 → [[rt_hub]].\n",
	"rt_in2.md": "Incoming hop 2 → [[rt_in1]].\n",
};

const HUB = "rt_hub.md";
const PIN_TARGET = "rt_x.md";
const IN2 = "rt_in2.md";

/** Non-default values so a stale default can never masquerade as "persisted". */
const DISTINCTIVE_MIN_PX = 47;
const DISTINCTIVE_NODE_CAP = 42;

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: RESTART_FIXTURES });
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

/** The panel's ACTIVE-note depth block (`:not` — the pinned block shares the base class). */
function depthSection(): Locator {
	return page.locator(".vicinity-graph-depth-controls:not(.vicinity-graph-depth-controls--pinned)");
}

function linksInDepthValue(): Locator {
	return depthSection()
		.locator(".vicinity-graph-stepper")
		.filter({ hasText: "Links in" })
		.locator(".vicinity-graph-stepper__value");
}

function toolbar(): Locator {
	return page.locator(".vicinity-graph-toolbar");
}

/**
 * Expands a native <details> via its `open` property — the exact end-state a
 * summary click produces. WHY-NOT click the summary: the controls panel is a
 * React-Flow overlay with an internal-scroll body, so a lower nested summary is
 * unreliably hit-test-intercepted by that body; the disclosure toggle is native
 * chrome, while the real controls under test (steppers/pins) are still clicked for real.
 */
async function ensureOpen(details: Locator): Promise<void> {
	await details.evaluate((el) => {
		(el as HTMLDetailsElement).open = true;
	});
}

async function clickPin(path: string): Promise<void> {
	const node = noteNode(path);
	await node.hover();
	await node.locator(".vicinity-graph-pin-button").click();
}

/**
 * Fires a control's real handler inside the overlay Panel (see the scenario spec
 * for the WHY-NOT-pointer-click rationale): the panel's controls can sit
 * off-viewport in a headless window, so we invoke the same onClick/onChange the
 * UI wires up — the control→persist→rebuild chain is what's under test.
 */
async function bumpLinksInDepth(): Promise<void> {
	await depthSection()
		.getByRole("button", { name: "Increase links in", exact: true })
		.evaluate((el) => (el as HTMLButtonElement).click());
}

/**
 * Fills a panel number input and COMMITS it, the same way a user leaving the field
 * does.
 *
 * The panel's typed fields are uncontrolled and commit ON BLUR (`NumberRowCommitPolicy`),
 * so a value plus an `input` event stores nothing on its own — the `focus` … `blur`
 * pair is what React turns into the `onBlur` that writes. The `input` event is kept
 * because real typing fires it.
 */
async function setNumberInput(input: Locator, value: number): Promise<void> {
	await input.evaluate((el, next) => {
		const field = el as HTMLInputElement;
		field.focus();
		field.value = String(next);
		field.dispatchEvent(new Event("input", { bubbles: true }));
		field.blur();
	}, value);
}

test("depth, pin, node cap and sizing all survive an Obsidian restart", async () => {
	// Two Obsidian boots (initial + relaunch) exceed the default per-test budget.
	test.setTimeout(200_000);
	await harness.remountGraphView();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");

	// §6 Pin (while the toolbar is collapsed so it can't cover the node): rt_x → pinned central.
	await clickPin(PIN_TARGET);
	await expect(noteNode(PIN_TARGET)).toHaveAttribute("data-tier", "pinned-central");

	// §1 Global depth: raise "Links in" 1 → 2, pulling the rt_in2 hop.
	await ensureOpen(toolbar());
	await bumpLinksInDepth();
	await expect(linksInDepthValue()).toHaveText("2");
	await expect(noteNode(IN2)).toHaveCount(1);

	// §11 Sizing (in-view mirror): set a distinctive minimum node size.
	await ensureOpen(page.locator(".vicinity-graph-sizing"));
	await setNumberInput(
		page.locator(".vicinity-graph-sizing").getByLabel("Minimum node size (px)"),
		DISTINCTIVE_MIN_PX,
	);
	await expect.poll(async () => (await harness.readGlobalView()).sizing.minPx).toBe(DISTINCTIVE_MIN_PX);

	// §13 Node cap: a distinctive global cap.
	await harness.setGlobalNodeCap(DISTINCTIVE_NODE_CAP);
	await expect.poll(async () => (await harness.readGlobalView()).nodeCap).toBe(DISTINCTIVE_NODE_CAP);

	// --- the restart -----------------------------------------------------------
	harness = await harness.relaunch();
	page = harness.page;
	await harness.openFile(HUB);
	await harness.remountGraphView();
	await expect(noteNode(HUB)).toHaveAttribute("data-tier", "main");
	await ensureOpen(toolbar());

	// §1 depth + §11/§13 globals reload immediately (they are all plain data.json fields):
	await expect(linksInDepthValue()).toHaveText("2"); // §1
	await expect(noteNode(IN2)).toHaveCount(1); // §1 — the value actually drives exploration
	const view = await harness.readGlobalView();
	expect(view.sizing.minPx).toBe(DISTINCTIVE_MIN_PX); // §11
	expect(view.nodeCap).toBe(DISTINCTIVE_NODE_CAP); // §13

	// §6 pin: persisted in the data.json pinned set, docid-KEYED — so its path only
	// resolves through a warmed path↔docid map. The FIRST build after a restart
	// warms what it needs on demand (ticket nid_gbyqsuplz8b7pv0u5k34sdz1q_e), so
	// this is a plain assertion: no polling, no waiting out the 15s orphan sweep.
	await expect(noteNode(PIN_TARGET)).toHaveAttribute("data-tier", "pinned-central");
});
