import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { ObsidianHarness } from "./obsidianHarness";

/**
 * OBSERVES what real Obsidian core itself puts in `metadataCache.resolvedLinks`
 * for MARKDOWN-STYLE inline links written in a canvas TEXT node.
 *
 * WHY this spec exists: the fallback canvas parser
 * (`src/adapters/CanvasFallbackParser.ts`) harvests those links so that the two
 * canvas link regimes agree (ticket `nid_ygo7h95ssgmunaqsprc1zlmfh_e`). "Core
 * reports them" is the PREMISE of that whole design, and every unit test of it
 * hand-seeds `resolvedLinks` — so no unit test can falsify the premise. This one
 * can: it is the only place where the `core-indexed` side is measured rather
 * than assumed. If it goes red, the fallback is emitting edges core never emits
 * and the design is inverted, not merely buggy.
 *
 * Deliberately launches with its OWN `extraFixtures` under `md-links/` instead of
 * touching `.dev-vault`: the shared fixtures' node/orphan counts are asserted to
 * the unit by `vicinityGraph.e2e.ts`, and this observation needs neither the
 * plugin's rendering nor its settings.
 */

test.describe.configure({ mode: "serial" });

const FIXTURE_FOLDER = "md-links";
const CANVAS_PATH = `${FIXTURE_FOLDER}/board.canvas`;
const TARGET_PATH = `${FIXTURE_FOLDER}/target.md`;
const SPACED_TARGET_PATH = `${FIXTURE_FOLDER}/spaced target.md`;
/** A note named by the FIRST WORD of the spaced destination — the phantom-edge bait. */
const PHANTOM_BAIT_PATH = `${FIXTURE_FOLDER}/spaced.md`;

/** Canvas re-index after a content touch; the metadata pass is not instant. */
const CANVAS_INDEX_TIMEOUT_MS = 20_000;

/**
 * One text node carrying every destination shape the matcher decides about, so a
 * single observation covers them all. `spaced target.md` appears BOTH unencoded
 * (not a link per CommonMark) and percent-encoded (a link).
 */
const CANVAS_TEXT = [
	"plain [plain](target.md)",
	"encoded [encoded](spaced%20target.md)",
	"unencoded space [spaced](spaced target.md)",
	"relative [rel](./target.md)",
	"parent-relative [up](../md-links/target.md)",
	"external [ext](https://example.com)",
	'titled [titled](target.md "A Title")',
].join(" — ");

const CANVAS_JSON = JSON.stringify({
	nodes: [{ id: "t1", type: "text", text: CANVAS_TEXT, x: 0, y: 0, width: 600, height: 300 }],
	edges: [],
});

const EXTRA_FIXTURES: Record<string, string> = {
	[CANVAS_PATH]: CANVAS_JSON,
	[TARGET_PATH]: "Target of the markdown-style canvas links.\n",
	[SPACED_TARGET_PATH]: "Target whose name contains a space.\n",
	[PHANTOM_BAIT_PATH]: "Bait: exists only so a truncated destination would resolve to something.\n",
};

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: EXTRA_FIXTURES });
	page = harness.page;
});

test.afterAll(async () => {
	await harness?.close();
});

/**
 * Canvas indexing is racy at boot (see `vicinityGraph.e2e.ts`: a canvas landed in
 * `resolvedLinks` in only 4 of 8 launches, and never later in the misses), so a
 * plain wait can hang forever. A trailing newline is a no-op for canvas JSON but
 * a real content change, which forces the re-index deterministically.
 */
async function indexedCanvasLinks(): Promise<Record<string, number>> {
	await page.evaluate(async (canvasPath) => {
		const app = (window as unknown as { app: any }).app;
		if (app.metadataCache.resolvedLinks[canvasPath] !== undefined) {
			return;
		}
		const file = app.vault.getAbstractFileByPath(canvasPath);
		await app.vault.modify(file, `${await app.vault.read(file)}\n`);
	}, CANVAS_PATH);
	await page.waitForFunction(
		(canvasPath) => (window as unknown as { app: any }).app.metadataCache.resolvedLinks[canvasPath] !== undefined,
		CANVAS_PATH,
		{ timeout: CANVAS_INDEX_TIMEOUT_MS },
	);
	return page.evaluate(
		(canvasPath) => (window as unknown as { app: any }).app.metadataCache.resolvedLinks[canvasPath],
		CANVAS_PATH,
	);
}

test("core indexes a canvas text node's markdown-style links, keyed by RESOLVED path", async () => {
	const links = await indexedCanvasLinks();
	// Printed so a future reader sees the raw observation, not just the verdict.
	console.log(`[observed] resolvedLinks[${CANVAS_PATH}]=${JSON.stringify(links)}`);
	// `toHaveProperty` would read the dots in the path as a property chain.
	expect(Object.keys(links)).toContain(TARGET_PATH);
});

test("core resolves a percent-encoded destination to the decoded file name", async () => {
	expect(Object.keys(await indexedCanvasLinks())).toContain(SPACED_TARGET_PATH);
});

test("core makes no link for a destination with an unencoded space (no phantom edge)", async () => {
	// The bait note exists, so truncating `spaced target.md` at the space WOULD
	// resolve — to the wrong document. Core does not; neither may the fallback.
	expect(Object.keys(await indexedCanvasLinks())).not.toContain(PHANTOM_BAIT_PATH);
});

test("core makes no link for an external URL", async () => {
	const links = await indexedCanvasLinks();
	expect(Object.keys(links).some((key) => key.includes("example.com"))).toBe(false);
});

/**
 * The `./` and `../` destinations in {@link CANVAS_TEXT} land on `target.md` too,
 * so core's own count folds them in — but the FALLBACK resolves through
 * `getFirstLinkpathDest` (`src/adapters/ObsidianLinkProvider.ts`) with the
 * destination passed through verbatim. Probing that seam directly is what says
 * whether the two regimes agree on relative destinations, and it is the same
 * question for every relative-path shape.
 */
test("the resolver seam the fallback uses accepts relative destinations verbatim", async () => {
	const resolved = await page.evaluate(
		([canvasPath, ...destinations]) => {
			const app = (window as unknown as { app: any }).app;
			return destinations.map(
				(destination) => app.metadataCache.getFirstLinkpathDest(destination, canvasPath)?.path ?? null,
			);
		},
		[CANVAS_PATH, "target.md", "./target.md", "../md-links/target.md", "spaced target.md"] as const,
	);
	console.log(`[observed] getFirstLinkpathDest=${JSON.stringify(resolved)}`);
	expect(resolved).toEqual([TARGET_PATH, TARGET_PATH, TARGET_PATH, SPACED_TARGET_PATH]);
});
