import { expect, test } from "@playwright/test";
import { OPEN_GRAPH_BELOW_COMMAND_ID, OPEN_GRAPH_COMMAND_ID, ObsidianHarness } from "./obsidianHarness";

/**
 * Placement e2e for `GraphViewOpener`: the two open commands are the ONLY way a
 * user chooses where the graph lives, and workspace splits are not fakeable in
 * node — so this is where the "one view, moved between regions" invariant is
 * actually verified.
 *
 * Serial with its own Obsidian instance: each test's GIVEN is the placement the
 * previous one left behind, which is precisely the move behaviour under test.
 */

test.describe.configure({ mode: "serial" });

let harness: ObsidianHarness;

test.beforeAll(async () => {
	harness = await ObsidianHarness.launch();
	await harness.openGraphView();
});

test.afterAll(async () => {
	await harness.close();
});

test("WHEN the open-below command runs on a sidebar-docked graph THEN the view MOVES to the main area", async () => {
	await harness.executeCommand(OPEN_GRAPH_BELOW_COMMAND_ID);
	await expect.poll(() => harness.graphViewPlacements()).toEqual(["main-area"]);
});

test("WHEN the open-below command repeats THEN no second view is created", async () => {
	await harness.executeCommand(OPEN_GRAPH_BELOW_COMMAND_ID);
	await expect.poll(() => harness.graphViewPlacements()).toEqual(["main-area"]);
});

test("WHEN the sidebar command runs on a main-area graph THEN the view MOVES back to the right sidebar", async () => {
	await harness.executeCommand(OPEN_GRAPH_COMMAND_ID);
	await expect.poll(() => harness.graphViewPlacements()).toEqual(["right-sidebar"]);
});
