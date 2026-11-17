// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkOccurrenceProvider } from "../engine";
import { EngineDefaults } from "../engine";
import { Tags } from "../shared/Tags";
import { makeGraph } from "./testFixtures/graphFixtures";
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

	buildForTag(): Promise<GraphBuildResult> {
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

/** A build that never settles — holds the pane in the `building` state to render. */
class PendingGraphSource {
	build(): Promise<GraphBuildResult | null> {
		return new Promise(() => undefined);
	}

	buildForTag(): Promise<GraphBuildResult> {
		return new Promise(() => undefined);
	}
}

/**
 * Mounts the flow over a controller whose FIRST build is still in flight — the
 * initial-load placeholder the user sees right after Obsidian opens. Uses the
 * real controller so the `isInitialBuild` flag is set by the pipeline, not by a
 * hand-built snapshot that would render even if the controller stopped setting it.
 */
function renderInitialBuildingPane(): void {
	const source = new PendingGraphSource();
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
	render(
		<VicinityGraphFlow
			controller={controller}
			ui={INERT_GRAPH_UI}
			actions={new RecordingControlsActions()}
			linkPreview={linkPreview}
		/>,
	);
}

describe("VicinityGraphFlow initial building state", () => {
	afterEach(() => {
		cleanup();
	});

	it("WHEN the first build after load is in flight THEN the placeholder says the wait is a one-off", () => {
		renderInitialBuildingPane();

		expect(
			screen.getByText("Building the vicinity graph for the first time — this is quicker afterwards…"),
		).toBeTruthy();
	});
});

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

/**
 * A tag nobody carries (tags-v1): the filter is STICKY, so the empty state is the
 * only screen the user has — it must say what is empty and offer the way out.
 * Driven through the real controller, like the failed state above.
 */
describe("VicinityGraphFlow empty tag state", () => {
	/** Resolves every tag build with an empty graph; note builds never settle. */
	class EmptyTagGraphSource {
		readonly calls: string[] = [];

		build(mainPath: string): Promise<GraphBuildResult | null> {
			this.calls.push(mainPath);
			return new Promise(() => undefined);
		}

		buildForTag(): Promise<GraphBuildResult> {
			return Promise.resolve({
				graph: makeGraph(),
				controls: {
					mainPinned: false,
					globalDepths: EngineDefaults.depthSettings(),
					globalView: EngineDefaults.viewSettings(),
					nodeExclusion: EngineDefaults.nodeExclusionSettings(),
					frontmatterLinks: EngineDefaults.frontmatterLinkSettings(),
					excludedNodeCount: 0,
				},
				pinFacts: { globalPinnedDocids: new Set<string>(), localPinnedDocids: new Set<string>() },
				folderNoteCandidates: { folderNoteCandidatesOf: () => [] },
				mainIsFolderNote: false,
			});
		}
	}

	async function renderEmptyTagPane(): Promise<EmptyTagGraphSource> {
		const source = new EmptyTagGraphSource();
		const linkPreview = new LinkPreviewOverlayStore();
		const controller = new GraphViewController(
			{ ...INERT_NAVIGATOR, activeFilePath: () => "a.md" },
			source,
			INERT_LAYOUT,
			INERT_ROUTER,
			INERT_OCCURRENCES,
			linkPreview,
		);
		const tag = Tags.parse("#nobody");
		if (tag === undefined) {
			throw new Error("fixture bug");
		}
		controller.enterTagMode(tag);
		await flush();
		render(
			<VicinityGraphFlow
				controller={controller}
				ui={INERT_GRAPH_UI}
				actions={new RecordingControlsActions()}
				linkPreview={linkPreview}
			/>,
		);
		return source;
	}

	afterEach(() => {
		cleanup();
	});

	it("WHEN no note carries the filter tag THEN the pane says so, naming the tag", async () => {
		await renderEmptyTagPane();

		expect(screen.getByText("No notes are tagged #nobody.")).toBeTruthy();
	});

	it("WHEN the exit is pressed on the empty tag state THEN the active note's vicinity is built", async () => {
		const source = await renderEmptyTagPane();

		fireEvent.click(screen.getByRole("button", { name: "Back to active note" }));

		expect(source.calls).toEqual(["a.md"]);
	});
});
