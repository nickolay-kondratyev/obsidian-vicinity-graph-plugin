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
 */
const RESTART_FIXTURES: Record<string, string> = {
	"rt_hub.md": "---\nid: docid_restarthub_e\n---\nRestart MAIN — links out to [[rt_x]].\n",
	"rt_x.md": "---\nid: docid_restartx_e\n---\nPin target — links out to [[rt_x1]].\n",
	"rt_x1.md": "Chain leaf.\n",
	"rt_in1.md": "Incoming hop 1 → [[rt_hub]].\n",
	"rt_in2.md": "Incoming hop 2 → [[rt_in1]].\n",
};

const HUB = "rt_hub.md";
const PIN_TARGET = "rt_x.md";
const IN2 = "rt_in2.md";

/** Non-default values so a stale default can never masquerade as "persisted". */
const DISTINCTIVE_WEIGHT = 7;
const DISTINCTIVE_NODE_CAP = 42;
const OWN_FILE_SIZE_METRIC = "own-file-size";

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

/** The panel's Depth section: the ONE global depth setting (drives MAIN and every pinned central). */
function depthSection(): Locator {
	return page.locator(".vicinity-graph-depth-controls");
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
		.getByRole("button", { name: "Increase links in" })
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
	// Two Obsidian boots (initial + relaunch) plus the up-to-40s post-restart sweep
	// poll exceed the default per-test budget.
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

	// §11 Sizing (in-view mirror): set a distinctive Own-file-size weight.
	await ensureOpen(page.locator(".vicinity-graph-sizing"));
	await setNumberInput(page.locator(".vicinity-graph-sizing").getByLabel("Own file size weight"), DISTINCTIVE_WEIGHT);
	await expect
		.poll(async () => (await harness.readGlobalView()).sizing.metrics[OWN_FILE_SIZE_METRIC]?.weight)
		.toBe(DISTINCTIVE_WEIGHT);

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
	expect(view.sizing.metrics[OWN_FILE_SIZE_METRIC]?.weight).toBe(DISTINCTIVE_WEIGHT); // §11
	expect(view.nodeCap).toBe(DISTINCTIVE_NODE_CAP); // §13

	// §6 pin: the pin IS persisted (data.json pinned set), but a pinned central's
	// docid→path resolution only warms after the delayed orphan sweep (15s), and a
	// rebuild must then pick it up. So poll with remounts until the pinned-central
	// status returns — this asserts the pin survives, on the product's real timing.
	await expect(async () => {
		await harness.remountGraphView();
		await expect(noteNode(PIN_TARGET)).toHaveAttribute("data-tier", "pinned-central", { timeout: 3_000 });
	}).toPass({ timeout: 40_000 });
});
