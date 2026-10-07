import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { SettingsRowNames, settingsRowsFor } from "../src/view/settingsRows";
import { ObsidianHarness, PLUGIN_ID } from "./obsidianHarness";
import type { E2eJsonHttpRequest, E2eObsidianApp } from "./obsidianInternals";

/**
 * Auto mode, end to end (task 4/4 `nid_80xc6z8umlpo1x6u4p1v7eb22_e`): the top-right
 * Relationships menu turns AI naming on, the plugin asks about the eligible edges of
 * the graph on screen, and the answer lands on the edge as an AI label. The rules
 * (which builds ask, caps, dedupe, failures) are unit-tested over the real queue
 * (`AiAutoNamingGate.test.ts`, `AiRelationshipQueue.test.ts`); this spec proves the
 * WIRING only a real Obsidian has — the menu, the settings fan-out, the vault reads,
 * the link cache, the id minting and the label.
 *
 * NO NETWORK, by design. The plugin's ONE outbound seam is the public `plugin.aiHttp`
 * (`JsonHttpPort`), which the real namer reads per request; the spec swaps in a
 * recording fake that answers in OpenAI's Responses shape. WHY this seam and not a
 * local stub HTTP server: the endpoint URL is a constant, so a stub server would need
 * a production base-URL knob that exists only for tests. Everything behind the seam —
 * key lookup (`OPENAI_API_KEY` set in the renderer), request body, answer parsing,
 * the name write — is the shipped code.
 *
 * Serial by design: ONE Obsidian instance, and the journeys build on each other
 * (the session's request log is shared).
 */

test.describe.configure({ mode: "serial" });

/** What the fake answers every request with: a valid relationship name. */
const AI_NAME = "refines";

/**
 * At least `MIN_AI_CONTENT_CHARS` of prose (links and whitespace do not count), so
 * every note carrying it passes the content half of eligibility.
 */
const PROSE =
	"This note carries enough real prose for the plugin to consider it worth naming. ".repeat(4) + "\n";

const MAIN = "ai-main.md";
/** Eligible: plain link, both notes long. */
const LONG = "ai-long.md";
/** Not eligible: too little prose. */
const SHORT = "ai-short.md";
/** Not eligible: MAIN names the link itself (`inspires:: [[ai-declared]]`). */
const DECLARED = "ai-declared.md";
const DECLARED_NAME = "inspires";
/** Not eligible: two notes in one folder render as a folder group. */
const GROUPED = ["ai-grp/ai-grp-one.md", "ai-grp/ai-grp-two.md"] as const;
const GROUP_EDGE_ID = `${MAIN}->folder-group:ai-grp`;

/** The off journey: Y is visited with auto mode OFF, Z with it back ON. */
const OFF_MAIN = "ai-y.md";
const OFF_TARGET = "ai-y-target.md";
const BACK_ON_MAIN = "ai-z.md";
const BACK_ON_TARGET = "ai-z-target.md";

const FIXTURES: Record<string, string> = {
	[MAIN]: `${PROSE}\n[[ai-long]]\n[[ai-short]]\n[[ai-grp-one]]\n[[ai-grp-two]]\n\n${DECLARED_NAME}:: [[ai-declared]]\n`,
	[LONG]: PROSE,
	[SHORT]: "Too short to name.\n",
	[DECLARED]: PROSE,
	[GROUPED[0]]: PROSE,
	[GROUPED[1]]: PROSE,
	[OFF_MAIN]: `${PROSE}\n[[ai-y-target]]\n`,
	[OFF_TARGET]: PROSE,
	[BACK_ON_MAIN]: `${PROSE}\n[[ai-z-target]]\n`,
	[BACK_ON_TARGET]: PROSE,
};

/** The key the namer finds in the environment — never sent anywhere (the fake records only the body). */
const FAKE_KEY = "sk-e2e-not-a-real-key";

let harness: ObsidianHarness;
let page: Page;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch({ extraFixtures: FIXTURES });
	page = harness.page;
	await installFakeOpenAi();
	await harness.openGraphView();
});

test.afterAll(async () => {
	await harness?.close();
});

/**
 * Replaces the plugin's HTTP seam with a fake that records each request's prompt
 * (`body.input`, which names both notes by title) on `window` and answers with a
 * one-name Responses body, and puts a key in the renderer's environment.
 */
async function installFakeOpenAi(): Promise<void> {
	await page.evaluate(
		({ pluginId, name, key }) => {
			process.env["OPENAI_API_KEY"] = key;
			const prompts: string[] = [];
			(window as unknown as { aiPrompts: string[] }).aiPrompts = prompts;
			const plugin = (window as unknown as { app: E2eObsidianApp }).app.plugins.plugins[pluginId]!;
			plugin.aiHttp = {
				postJson: (request: E2eJsonHttpRequest) => {
					const input = (request.body as { input?: unknown }).input;
					prompts.push(typeof input === "string" ? input : JSON.stringify(request.body));
					return Promise.resolve({
						status: 200,
						json: {
							status: "completed",
							output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ name }) }] }],
							usage: { input_tokens: 100, output_tokens: 3 },
						},
					});
				},
			};
		},
		{ pluginId: PLUGIN_ID, name: AI_NAME, key: FAKE_KEY },
	);
}

/** Every prompt the fake was sent so far, in order. */
async function sentPrompts(): Promise<readonly string[]> {
	return page.evaluate(() => [...(window as unknown as { aiPrompts: string[] }).aiPrompts]);
}

/** Whether a prompt is about `vaultPath`'s note — prompts name each note by its title. */
function mentions(prompt: string, vaultPath: string): boolean {
	const title = vaultPath.replace(/^.*\//, "").replace(/\.md$/, "");
	return prompt.includes(`title="${title}"`);
}

async function openMain(path: string): Promise<void> {
	await harness.openFile(path);
	await expect(page.locator(`.vicinity-graph-node[data-vicinity-path="${path}"]`)).toHaveAttribute("data-tier", "main");
}

function edgeId(source: string, target: string): string {
	return `${source}->${target}`;
}

function edgeName(id: string): Locator {
	return page.locator(`.vicinity-graph-edge__label[data-edge-id="${id}"] .vicinity-graph-edge__relationship`);
}

function menu(): Locator {
	return page.locator(".vicinity-graph-relationships-menu");
}

function menuStatus(): Locator {
	return menu().getByRole("status");
}

function autoNamingToggle(): Locator {
	const [row] = settingsRowsFor("ai-auto-naming");
	if (row === undefined) {
		throw new Error("the declared model has no ai-auto-naming row");
	}
	return menu().getByRole("checkbox", { name: SettingsRowNames.sole(row), exact: true });
}

/**
 * Flips AI naming from the menu, then waits until the STORE holds the new value —
 * the ordering barrier for every build after it (each build reads the settings
 * fresh), so no sleep is needed.
 */
async function setAutoNaming(on: boolean): Promise<void> {
	await menu().evaluate((root) => {
		(root as HTMLDetailsElement).open = true;
	});
	const toggle = autoNamingToggle();
	if ((await toggle.isChecked()) !== on) {
		// The switch's input is visually replaced by its track; click it as the label would.
		await toggle.evaluate((el) => (el as HTMLInputElement).click());
	}
	await expect(toggle).toBeChecked({ checked: on });
	await page.waitForFunction(
		({ pluginId, expected }) =>
			(window as unknown as { app: E2eObsidianApp }).app.plugins.plugins[pluginId]?.pluginDataStore.relationships()
				.autoNaming === expected,
		{ pluginId: PLUGIN_ID, expected: on },
	);
}

test("turning AI naming on labels an eligible edge with the model's name, marked as AI", async () => {
	await openMain(MAIN);
	await setAutoNaming(true);
	const label = edgeName(edgeId(MAIN, LONG));
	await expect(label).toHaveText(AI_NAME);
	await expect(label).toHaveAttribute("data-origin", "ai");
});

test("the menu reports what this session named", async () => {
	// Idle and named: everything that build submitted has been answered.
	await expect(menuStatus()).toHaveText(/^Named 1 this session/);
});

test("a short note's edge is never sent", async () => {
	// Ordering barrier: the status above is idle, so that build's work is done.
	await expect(menuStatus()).toHaveText(/^Named 1 this session/);
	expect((await sentPrompts()).filter((prompt) => mentions(prompt, SHORT))).toEqual([]);
});

test("a short note's edge carries no AI label", async () => {
	await expect(page.locator(`.react-flow__edge[data-id="${edgeId(MAIN, SHORT)}"]`)).toHaveCount(1);
	await expect(edgeName(edgeId(MAIN, SHORT))).toHaveCount(0);
});

test("an edge the note names itself keeps its own name and is never sent", async () => {
	await expect(edgeName(edgeId(MAIN, DECLARED))).toHaveText(DECLARED_NAME);
	expect((await sentPrompts()).filter((prompt) => mentions(prompt, DECLARED))).toEqual([]);
});

test("notes inside a folder group are never sent", async () => {
	// The group really formed (its collapsed edge is on screen), so the exclusion is exercised.
	await expect(page.locator(`.react-flow__edge[data-id="${GROUP_EDGE_ID}"]`)).toHaveCount(1);
	const grouped = (await sentPrompts()).filter((prompt) => GROUPED.some((path) => mentions(prompt, path)));
	expect(grouped).toEqual([]);
});

test("with AI naming off, visiting a new note sends nothing", async () => {
	// GIVEN auto mode is turned off, and a note with an eligible edge is opened.
	await setAutoNaming(false);
	await openMain(OFF_MAIN);
	await expect(page.locator(`.react-flow__edge[data-id="${edgeId(OFF_MAIN, OFF_TARGET)}"]`)).toHaveCount(1);

	// WHEN auto mode is turned back on over ANOTHER note, and that note's edge is named
	// (the ordering barrier: a request for Y would have gone out while Y was on screen,
	// long before Z's answer arrives).
	await openMain(BACK_ON_MAIN);
	await setAutoNaming(true);
	await expect(edgeName(edgeId(BACK_ON_MAIN, BACK_ON_TARGET))).toHaveText(AI_NAME);

	// THEN nothing was ever sent about Y.
	expect((await sentPrompts()).filter((prompt) => mentions(prompt, OFF_TARGET))).toEqual([]);
});
