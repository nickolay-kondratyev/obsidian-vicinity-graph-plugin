// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkOccurrenceProvider } from "../engine";
import { GraphViewController } from "./GraphViewController";
import { LinkPreviewOverlayStore } from "./LinkPreviewOverlayStore";
import { RecordingControlsActions } from "./testFixtures/settingsPanelHarness";
import { VicinityGraphFlow } from "./VicinityGraphFlow";
import type {
	GraphBuildResult,
	GraphLayoutPort,
	GraphUiPort,
	NoteNavigatorPort,
} from "./viewPorts";
import type { EdgeRouter } from "./edgeRouting";

/**
 * The rendered half of the rebuild failure policy (ticket
 * nid_iqna8b4j5339pjiga7kgwdnh7_e). `GraphViewController.test.ts` proves the
 * controller reaches the `failed` status and that `retryRebuild()` re-enters the
 * pipeline; NOTHING there proves the pane offers the user a way to call it — and
 * that button is the only way back short of a vault/settings event, on a screen
 * the user only reaches when something already went wrong.
 *
 * So this mounts the REAL component over the REAL controller, driven into failure
 * through the one collaborator that can fail (a rejecting {@link GraphSourcePort}).
 * No snapshot is hand-built: a fake snapshot would still render if the controller
 * stopped publishing this status at all.
 */

/** Drains the microtask queue so a rejected build's retry + publish run. */
function flush(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

/** Rejects every build, recording the attempts — the only failing collaborator. */
class RejectingGraphSource {
	readonly calls: string[] = [];

	build(mainPath: string): Promise<GraphBuildResult | null> {
		this.calls.push(mainPath);
		return Promise.reject(new Error("vault read failed"));
	}
}

/**
 * Collaborators the failure path must never reach: the build rejects before
 * layout, routing or navigation, and the failure screen renders no node. They
 * THROW rather than no-op so a future change that starts calling them fails this
 * suite loudly instead of passing over a silently inert fake.
 */
function unreachable(method: string): never {
	throw new Error(`the failed state must not reach ${method}`);
}

const INERT_NAVIGATOR: NoteNavigatorPort = {
	activeFilePath: () => null,
	openNote: () => unreachable("NoteNavigatorPort.openNote"),
	openMarkdownLink: () => unreachable("NoteNavigatorPort.openMarkdownLink"),
};

const INERT_LAYOUT: GraphLayoutPort = {
	layout: () => unreachable("GraphLayoutPort.layout"),
};

const INERT_ROUTER: EdgeRouter = {
	route: () => unreachable("EdgeRouter.route"),
};

const INERT_OCCURRENCES: LinkOccurrenceProvider = {
	occurrencesBetween: () => unreachable("LinkOccurrenceProvider.occurrencesBetween"),
};

const INERT_GRAPH_UI: GraphUiPort = {
	resourcePath: () => unreachable("GraphUiPort.resourcePath"),
	showAttachmentMenu: () => unreachable("GraphUiPort.showAttachmentMenu"),
	showNodeMenu: () => unreachable("GraphUiPort.showNodeMenu"),
	renderIcon: () => unreachable("GraphUiPort.renderIcon"),
	renderMarkdown: () => unreachable("GraphUiPort.renderMarkdown"),
};

interface FailedPaneHarness {
	readonly source: RejectingGraphSource;
}

/**
 * Mounts the flow over a controller whose every build attempt rejected, i.e. at
 * the terminal `failed` answer the user actually sees.
 */
async function renderFailedPane(): Promise<FailedPaneHarness> {
	const source = new RejectingGraphSource();
	const linkPreview = new LinkPreviewOverlayStore();
	const controller = new GraphViewController(
		INERT_NAVIGATOR,
		source,
		INERT_LAYOUT,
		INERT_ROUTER,
		INERT_OCCURRENCES,
		linkPreview,
	);
	controller.handleActiveFileChanged("a.md");
	await flush();
	render(
		<VicinityGraphFlow
			controller={controller}
			ui={INERT_GRAPH_UI}
			actions={new RecordingControlsActions()}
			linkPreview={linkPreview}
		/>,
	);
	return { source };
}

describe("VicinityGraphFlow failed state", () => {
	let consoleError: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		// The controller reports every spent attempt; the suite drives failures on purpose.
		consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		cleanup();
		consoleError.mockRestore();
	});

	it("WHEN every rebuild attempt failed THEN the pane says the graph could not be built", async () => {
		await renderFailedPane();

		expect(screen.getByText("Could not build the vicinity graph for the active file.")).toBeTruthy();
	});

	it("WHEN every rebuild attempt failed THEN the pane offers a retry the user can press", async () => {
		await renderFailedPane();

		expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
	});

	it("WHEN the retry is pressed THEN a fresh build runs", async () => {
		const h = await renderFailedPane();
		const attemptsBeforeRetry = h.source.calls.length;

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(h.source.calls.length).toBe(attemptsBeforeRetry + 1);
	});

	it("WHEN the retry is pressed THEN the failure copy gives way to the placeholder", async () => {
		await renderFailedPane();

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(screen.getByText("Building the vicinity graph…")).toBeTruthy();
	});
});
