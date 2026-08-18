import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { EngineDefaults } from "../src/engine";
import { ObsidianHarness } from "./obsidianHarness";
import type { E2eObsidianApp } from "./obsidianInternals";

/**
 * Named-link TRAVERSAL DEPTH against a real Obsidian (ticket
 * nid_wecll6kqjlq3jmdkudq092xte_e): a chain written PURELY as Dataview-style
 * named links (`supports::[[x]]`, no space after `::` — the reported repro's
 * exact shape) must be reachable at depth 2 in BOTH directions. The engine
 * layer already proves the chain BFS over Fake providers
 * (`src/engine/namedRelationships.test.ts`); this spec locks the real-vault
 * half the report was about — Obsidian's metadata cache + the eager
 * named-relationships index feeding the SAME chain through to rendered nodes.
 *
 * Fixture chain (all root-level, `nld-` prefix so basenames collide with
 * nothing in the copied dev vault):
 *
 *   nld-a.md --supports--> nld-b.md --supports--> nld-c.md
 *
 * Serial by design: ONE Obsidian instance; each test saves its own depth
 * slice before opening its main note, so a graph's reach is attributable to
 * one dial (the engine suite's pattern).
 */

test.describe.configure({ mode: "serial" });

const CHAIN_FIXTURES: Record<string, string> = {
	// No space after `::` — the reported repro wrote `supports::[[B]]` exactly.
	"nld-a.md": "supports::[[nld-b]]\n",
	"nld-b.md": "supports::[[nld-c]]\n",
	"nld-c.md": "The chain tail exists.\n",
};

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: CHAIN_FIXTURES });
	page = harness.page;
	await harness.openGraphView();
});

test.afterAll(async () => {
	await harness?.close();
});

function noteNode(path: string): Locator {
	return page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`);
}

test("WHEN links out is 2 THEN a named-link chain is walked two hops OUT (the reported repro)", async () => {
	// The reported gesture verbatim: product defaults, then "Links out" set to 2.
	await harness.saveGlobalDepths({ ...EngineDefaults.depthSettings(), linkDepthOut: 2 });
	await harness.openFile("nld-a.md");
	await expect(noteNode("nld-a.md")).toHaveAttribute("data-tier", "main");

	await expect(noteNode("nld-b.md")).toBeVisible();
	await expect(noteNode("nld-c.md")).toBeVisible();
});

test("WHEN ONLY named links in is 2 THEN the chain is walked two hops IN (named-incoming channel alone)", async () => {
	// Every other dial 0 so the reach is attributable to namedDepthIn alone.
	await harness.saveGlobalDepths({
		...EngineDefaults.depthSettings(),
		linkDepthOut: 0,
		embedDepthOut: 0,
		linkDepthIn: 0,
		namedDepthOut: 0,
		namedDepthIn: 2,
		descendantDepth: 0,
		ancestorDepth: 0,
	});
	await harness.openFile("nld-c.md");
	await expect(noteNode("nld-c.md")).toHaveAttribute("data-tier", "main");

	await expect(noteNode("nld-b.md")).toBeVisible();
	await expect(noteNode("nld-a.md")).toBeVisible();
});

test("WHEN a named link is written LIVE mid-session THEN the open graph reaches through it at depth 2", async () => {
	// The realistic gesture behind the report: the graph is already open when the
	// notes gain their named links — exercises the named index's 'changed'
	// freshness path and the rebuild fan-out, which a cold boot never touches.
	await harness.saveGlobalDepths({ ...EngineDefaults.depthSettings(), linkDepthOut: 2 });
	await harness.openFile("nld-a.md");
	await expect(noteNode("nld-a.md")).toHaveAttribute("data-tier", "main");
	await expect(noteNode("nld-c.md")).toBeVisible();

	// Live: mint a NEW tail note, then extend the chain nld-b --supports--> nld-d.
	await page.evaluate(async () => {
		const app = (window as unknown as { app: E2eObsidianApp }).app;
		await app.vault.create("nld-d.md", "The live-minted tail exists.\n");
		const chainMiddle = app.vault.getAbstractFileByPath("nld-b.md");
		if (chainMiddle === null) {
			throw new Error("e2e: fixture nld-b.md is missing from the vault");
		}
		await app.vault.modify(chainMiddle, "supports::[[nld-c]]\nsupports::[[nld-d]]\n");
	});

	await expect(noteNode("nld-d.md")).toBeVisible();
});
