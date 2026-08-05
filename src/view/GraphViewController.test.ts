import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ElkNode } from "elkjs";
import type { ForceLayoutSettings, LinkOccurrenceProvider, OutlineEntry, VicinityGraph } from "../engine";
import { asFolderPath, asVaultPath, EngineDefaults, FakeLinkOccurrenceProvider } from "../engine";
import { REBUILD_DEBOUNCE_MS } from "./constants";
import { GraphViewController } from "./GraphViewController";
import type { FlowSnapshot } from "./GraphViewController";
import type { FlowNode, NoteFlowNode } from "./flowMapping";
import type { ControlsModel } from "./ControlsModel";
import type { EdgePreviewModel } from "./linkPreviewModel";
import type {
	GraphBuildResult,
	GraphLayoutPort,
	GraphSourcePort,
	LinkPreviewPort,
	NoteNavigatorPort,
	OpenNoteOptions,
} from "./viewPorts";
import type { EdgeRouteMap, EdgeRouter, EdgeRoutingInput } from "./edgeRouting";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

/** These tests exercise rebuild concurrency, not the toolbar model — an empty model suffices. */
const EMPTY_CONTROLS: ControlsModel = {
	mainPinned: false,
	globalDepths: EngineDefaults.depthSettings(),
	globalView: EngineDefaults.viewSettings(),
	nodeExclusion: EngineDefaults.nodeExclusionSettings(),
	excludedNodeCount: 0,
};

/**
 * Controller orchestration tests: latest-wins concurrency, null/empty handling,
 * MAIN gating, and the structural-diff skip/relayout branches. All collaborators
 * are plain structural fakes (no obsidian runtime mock, no React, no elk mounted).
 * Rebuilds are driven by resolving DEFERRED build promises in a chosen order —
 * concurrency is controlled explicitly, never by sleeps or timers. The one
 * exception is the debounce describe block at the bottom, which drives the
 * metadata-resolve timer with Vitest FAKE timers (deterministic, no real wait)
 * plus a `window` shim, since the controller debounces via `window.setTimeout`.
 */

interface Deferred<T> {
	readonly promise: Promise<T>;
	resolve(value: T): void;
	reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** Drains the microtask queue so a resolved build's pipeline continuation runs. */
function flush(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

/** Records every `build(path)` and hands back a promise the test resolves by index. */
class FakeGraphSource implements GraphSourcePort {
	readonly calls: string[] = [];
	private readonly deferreds: Deferred<GraphBuildResult | null>[] = [];

	build(mainPath: string): Promise<GraphBuildResult | null> {
		this.calls.push(mainPath);
		const pending = deferred<GraphBuildResult | null>();
		this.deferreds.push(pending);
		return pending.promise;
	}

	/** Tests supply just the graph; the empty controls model is attached here. */
	resolveBuild(index: number, graph: VicinityGraph | null): void {
		this.pendingAt(index).resolve(graph === null ? null : { graph, controls: EMPTY_CONTROLS });
	}

	/** The real builder reads the vault and can reject (e.g. a file deleted mid-read). */
	rejectBuild(index: number, error: unknown): void {
		this.pendingAt(index).reject(error);
	}

	/** Whether a build was started at this index — how the failure tests find the automatic retry. */
	hasPendingAt(index: number): boolean {
		return this.deferreds[index] !== undefined;
	}

	private pendingAt(index: number): Deferred<GraphBuildResult | null> {
		const pending = this.deferreds[index];
		if (pending === undefined) {
			throw new Error(`no pending build at index ${index}`);
		}
		return pending;
	}
}

/**
 * Fixed box FakeLayout stamps on a folder-group container. Elk sizes a container
 * to wrap its children; the fake gives it a deterministic, DISTINCT box (width
 * differs from the 100px note square) so a terminus clipped to the group's right
 * edge (x = FAKE_GROUP_WIDTH_PX) is unmistakably the GROUP boundary — derived from
 * groupDimensions — and not a note boundary.
 */
const FAKE_GROUP_WIDTH_PX = 150;
const FAKE_GROUP_HEIGHT_PX = 100;

/**
 * Lays children out at deterministic, distinct coordinates and counts invocations.
 * Records the forwarded force-layout settings: the real runner defaults the
 * parameter when omitted, so only recording it here can catch a controller that
 * silently stops passing the graph's resolved values.
 */
class FakeLayout implements GraphLayoutPort {
	callCount = 0;
	lastForceLayout: ForceLayoutSettings | undefined;

	async layout(graph: ElkNode, forceLayout?: ForceLayoutSettings): Promise<ElkNode> {
		this.callCount += 1;
		this.lastForceLayout = forceLayout;
		const children = (graph.children ?? []).map((child, index) => {
			const placed = { ...child, x: index * 200, y: 0 };
			// A folder-group container carries `children`; elk sizes it to wrap them.
			// Leaves already echo their engine square, so only containers get a box here.
			return child.children === undefined
				? placed
				: { ...placed, width: FAKE_GROUP_WIDTH_PX, height: FAKE_GROUP_HEIGHT_PX };
		});
		return { ...graph, children };
	}
}

/**
 * A non-`Error` throwable for the router to raise. Wrapped because the raw value
 * would be indistinguishable from a route-map/Error response.
 */
class NonErrorThrow {
	constructor(readonly value: unknown) {}
}

type FakeRouterResponse = EdgeRouteMap | Error | NonErrorThrow;

/**
 * Records every `route(input)` and returns a preset response — a route map, or a
 * value to throw (failure-fallback tests). Default response is empty (no routing).
 */
class FakeEdgeRouter implements EdgeRouter {
	callCount = 0;
	lastInput: EdgeRoutingInput | null = null;

	constructor(private response: FakeRouterResponse = new Map()) {}

	setResponse(response: FakeRouterResponse): void {
		this.response = response;
	}

	async route(input: EdgeRoutingInput): Promise<EdgeRouteMap> {
		this.callCount += 1;
		this.lastInput = input;
		if (this.response instanceof Error) {
			throw this.response;
		}
		if (this.response instanceof NonErrorThrow) {
			throw this.response.value;
		}
		return this.response;
	}
}

class FakeNavigator implements NoteNavigatorPort {
	readonly opened: string[] = [];
	readonly openedOptions: (OpenNoteOptions | undefined)[] = [];
	readonly openedMarkdownLinks: { linktext: string; sourcePath: string }[] = [];
	activePath: string | null = null;

	activeFilePath(): string | null {
		return this.activePath;
	}

	openNote(path: string, options?: OpenNoteOptions): void {
		this.opened.push(path);
		this.openedOptions.push(options);
	}

	openMarkdownLink(linktext: string, sourcePath: string): void {
		this.openedMarkdownLinks.push({ linktext, sourcePath });
	}
}

/** Records every model the controller asked the modal seam to show. */
class FakeLinkPreview implements LinkPreviewPort {
	readonly shown: EdgePreviewModel[] = [];

	showLinkPreview(model: EdgePreviewModel): void {
		this.shown.push(model);
	}
}

interface Harness {
	readonly controller: GraphViewController;
	readonly source: FakeGraphSource;
	readonly layout: FakeLayout;
	readonly navigator: FakeNavigator;
	readonly router: FakeEdgeRouter;
	readonly linkPreview: FakeLinkPreview;
	snapshot(): FlowSnapshot;
}

function setup(
	router: FakeEdgeRouter = new FakeEdgeRouter(),
	occurrences: LinkOccurrenceProvider = new FakeLinkOccurrenceProvider({}),
): Harness {
	const source = new FakeGraphSource();
	const layout = new FakeLayout();
	const navigator = new FakeNavigator();
	const linkPreview = new FakeLinkPreview();
	const controller = new GraphViewController(navigator, source, layout, router, occurrences, linkPreview);
	return { controller, source, layout, navigator, router, linkPreview, snapshot: () => controller.getSnapshot() };
}

/**
 * Rejects the build at `firstIndex` and every automatic retry it spawns, leaving
 * the controller at its terminal failure answer. Driven by what the source was
 * ASKED for rather than by a copy of the attempt budget, so raising/lowering
 * `REBUILD_ATTEMPTS` cannot silently leave these tests mid-sequence.
 */
async function rejectEveryAttempt(h: Harness, firstIndex: number): Promise<void> {
	for (let index = firstIndex; h.source.hasPendingAt(index); index += 1) {
		h.source.rejectBuild(index, new Error("vault read failed"));
		await flush();
	}
}

function nodeIds(snapshot: FlowSnapshot): string[] {
	return snapshot.nodes.map((node) => node.id);
}

/** The note node with this id — folder-group nodes carry a different data shape. */
function noteNode(nodes: readonly FlowNode[], id: string): NoteFlowNode | undefined {
	const found = nodes.find((node) => node.id === id);
	return found?.kind === "note" ? found : undefined;
}

/** A graph whose first path is central and the rest are edge-linked neighbours. */
function graphOf(centralPath: string, ...neighbourPaths: string[]): VicinityGraph {
	const nodes = [centralPath, ...neighbourPaths].map((path) => makeNode({ path: asVaultPath(path) }));
	const edges = neighbourPaths.map((path) => makeEdge(centralPath, path));
	return makeGraph({ nodes, edges });
}

describe("GraphViewController latest-wins concurrency", () => {
	it("WHEN an earlier build resolves after a newer rebuild superseded it THEN the stale result is discarded", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md"); // token 1, build[0] in flight
		h.controller.handleActiveFileChanged("b.md"); // token 2 supersedes it, build[1] in flight

		h.source.resolveBuild(0, graphOf("a.md")); // stale result arrives first
		await flush();

		// The newer build is still in flight and nothing has rendered yet.
		expect(h.snapshot().status).toBe("building");
	});

	it("WHEN the stale build resolves THEN it never reaches elk layout", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.controller.handleActiveFileChanged("b.md");

		h.source.resolveBuild(0, graphOf("a.md"));
		await flush();

		expect(h.layout.callCount).toBe(0);
	});

	it("WHEN the latest build resolves (out of order, after the stale one) THEN only its graph is rendered", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.controller.handleActiveFileChanged("b.md");

		h.source.resolveBuild(0, graphOf("a.md")); // stale
		await flush();
		h.source.resolveBuild(1, graphOf("b.md")); // latest
		await flush();

		expect(nodeIds(h.snapshot())).toEqual(["b.md"]);
	});
});

describe("GraphViewController null / empty handling", () => {
	it("WHEN build() returns null THEN the snapshot is empty", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");

		h.source.resolveBuild(0, null);
		await flush();

		expect(h.snapshot().status).toBe("empty");
	});

	it("WHEN build() returns a graph with no nodes THEN the snapshot is empty", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");

		h.source.resolveBuild(0, makeGraph({ nodes: [], edges: [] }));
		await flush();

		expect(h.snapshot().status).toBe("empty");
	});
});

/**
 * First paint honesty (ticket nid_y081nezeucka9l0x3umebi5zo_e): the FIRST build
 * AWAITS the docid warm-up, which reads file content and on a large vault takes
 * seconds. While that runs the view has nothing to show — and the empty state's
 * copy is a WRONG answer ("no vicinity graph for this file"), not a pending one.
 * That warm-up is paid ONCE, so only that build may show the placeholder: every
 * later rebuild is fast, and a placeholder there would flicker the pane — over a
 * rendered graph and equally over the empty state, which rebuilds on every
 * metadata resolve.
 */
describe("GraphViewController first-paint building state", () => {
	it("WHEN the first build is in flight THEN the snapshot reports building", () => {
		const h = setup();

		h.controller.handleActiveFileChanged("a.md");

		expect(h.snapshot().status).toBe("building");
	});

	it("WHEN a build is in flight while a graph is rendered THEN the rendered graph stays published", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("a.md"));
		await flush();

		h.controller.handleSettingsChanged();

		expect(h.snapshot().status).toBe("ready");
	});

	it("WHEN a build resolves with no graph THEN the building state gives way to empty", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");

		h.source.resolveBuild(0, null);
		await flush();

		expect(h.snapshot().status).toBe("empty");
	});

	it("WHEN a rebuild follows a build that settled empty THEN the empty state is not replaced by the placeholder", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, null);
		await flush();

		h.controller.handleSettingsChanged();

		expect(h.snapshot().status).toBe("empty");
	});

	it("WHEN the first build rejects THEN the placeholder gives way to the failed state", async () => {
		const h = setup();
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
		h.controller.handleActiveFileChanged("a.md");

		await rejectEveryAttempt(h, 0);

		expect(h.snapshot().status).toBe("failed");
		consoleError.mockRestore();
	});
});

/**
 * Rebuild failure policy (ticket nid_iqna8b4j5339pjiga7kgwdnh7_e). A build can
 * REJECT — the main doc's identity read is a content read that loses its race
 * when the file goes away between the index lookup and the read. Those failures
 * are races, not verdicts, so one automatic retry runs first; only when that is
 * also spent does the view declare the rebuild FAILED and hand the user a manual
 * way back in. ONE policy for every cause and every prior screen — a rendered
 * graph is NOT kept, because it predates the vault state the failed pass tried to
 * read and leaving it up would pass it off as current.
 */
describe("GraphViewController rebuild failure policy", () => {
	let consoleError: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		consoleError.mockRestore();
	});

	it("WHEN a build rejects THEN it is retried automatically", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");

		h.source.rejectBuild(0, new Error("vault read failed"));
		await flush();

		expect(h.source.calls).toEqual(["a.md", "a.md"]);
	});

	it("WHEN the automatic retry succeeds THEN its graph is rendered", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");

		h.source.rejectBuild(0, new Error("vault read failed"));
		await flush();
		h.source.resolveBuild(1, graphOf("a.md"));
		await flush();

		expect(nodeIds(h.snapshot())).toEqual(["a.md"]);
	});

	it("WHEN the automatic retry also rejects THEN no further attempt is made", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");

		await rejectEveryAttempt(h, 0);

		expect(h.source.calls).toEqual(["a.md", "a.md"]);
	});

	it("WHEN a rebuild fails while a graph is rendered THEN the failed state replaces it", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("a.md"));
		await flush();

		h.controller.handleSettingsChanged();
		await rejectEveryAttempt(h, 1);

		expect(h.snapshot().status).toBe("failed");
	});

	it("WHEN a rejecting build was superseded THEN it is not retried", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md"); // token 1, build[0]
		h.controller.handleActiveFileChanged("b.md"); // token 2 supersedes it, build[1]

		h.source.rejectBuild(0, new Error("vault read failed"));
		await flush();

		expect(h.source.calls).toEqual(["a.md", "b.md"]);
	});

	it("WHEN a rejecting build was superseded THEN the failed state is not published over its successor", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.controller.handleActiveFileChanged("b.md");

		h.source.rejectBuild(0, new Error("vault read failed"));
		await flush();
		h.source.resolveBuild(1, graphOf("b.md"));
		await flush();

		expect(nodeIds(h.snapshot())).toEqual(["b.md"]);
	});

	it("WHEN the user retries from the failed state THEN a fresh build runs", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		await rejectEveryAttempt(h, 0);

		h.controller.retryRebuild();

		expect(h.source.calls).toEqual(["a.md", "a.md", "a.md"]);
	});

	it("WHEN the user retries from the failed state THEN the failure copy gives way to the placeholder", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		await rejectEveryAttempt(h, 0);

		h.controller.retryRebuild();

		expect(h.snapshot().status).toBe("building");
	});

	it("WHEN a retried build resolves THEN its graph is rendered", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		await rejectEveryAttempt(h, 0);

		h.controller.retryRebuild();
		h.source.resolveBuild(2, graphOf("a.md"));
		await flush();

		expect(nodeIds(h.snapshot())).toEqual(["a.md"]);
	});
});

describe("GraphViewController MAIN gating", () => {
	it("WHEN a non-node-bearing file becomes active THEN no rebuild is triggered", () => {
		const h = setup();
		h.controller.handleActiveFileChanged("assets/pic.png");

		expect(h.source.calls).toEqual([]);
	});

	it("WHEN the delegate node is opened THEN it is forwarded to the navigator", () => {
		const h = setup();
		h.controller.openNode("notes/a.md");

		expect(h.navigator.opened).toEqual(["notes/a.md"]);
	});

	it("WHEN a node is ctrl/cmd-clicked THEN the new-tab option reaches the navigator", () => {
		const h = setup();
		h.controller.openNode("notes/a.md", { newTab: true });

		expect(h.navigator.openedOptions).toEqual([{ newTab: true }]);
	});

	it("WHEN an outline entry is opened THEN the RAW heading reaches the navigator verbatim", () => {
		const h = setup();
		// Sanitising is the ADAPTER's job (obsidian's `stripHeadingForLink`), so the
		// controller must not touch the heading on the way through.
		h.controller.openNode("notes/a.md", { newTab: false, heading: "Status of [[note1]] **today**" });

		expect(h.navigator.openedOptions).toEqual([{ newTab: false, heading: "Status of [[note1]] **today**" }]);
	});

	it("WHEN a rendered snippet's internal link is opened THEN linktext and sourcePath reach the navigator verbatim", () => {
		const h = setup();
		h.controller.openMarkdownLink("Target Note#Heading", "notes/a.md");

		expect(h.navigator.openedMarkdownLinks).toEqual([{ linktext: "Target Note#Heading", sourcePath: "notes/a.md" }]);
	});
});

describe("GraphViewController settings-changed rebuild", () => {
	it("WHEN handleSettingsChanged is called THEN it rebuilds the current MAIN immediately", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("a.md"));
		await flush();

		h.controller.handleSettingsChanged();

		expect(h.source.calls).toEqual(["a.md", "a.md"]);
	});
});

describe("GraphViewController structural diff", () => {
	it("WHEN the next graph has the same structure THEN elk layout is skipped (reuse)", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("n1.md", "n2.md"));
		await flush();

		h.controller.handleActiveFileChanged("b.md"); // different MAIN, identical node/edge id-set
		h.source.resolveBuild(1, graphOf("n1.md", "n2.md"));
		await flush();

		expect(h.layout.callCount).toBe(1);
	});

	it("WHEN layout is reused THEN prior node positions are preserved", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("n1.md", "n2.md"));
		await flush();
		const laidOut = h.snapshot().nodes.map((node) => node.position);

		h.controller.handleActiveFileChanged("b.md");
		h.source.resolveBuild(1, graphOf("n1.md", "n2.md"));
		await flush();

		expect(h.snapshot().nodes.map((node) => node.position)).toEqual(laidOut);
	});

	it("WHEN a build lays out THEN the graph's resolved force-layout settings reach the layout runner", async () => {
		// A NON-default value: proves the controller forwards the graph's RESOLVED
		// settings — with the argument dropped, the runner would silently fall back
		// to engine defaults and the d3 sliders would become no-ops.
		const NON_DEFAULT_LINK_GAP_PX = 77;
		const forceLayout = { ...EngineDefaults.forceLayoutSettings(), linkGapPx: NON_DEFAULT_LINK_GAP_PX };
		const base = graphOf("a.md");
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, { ...base, viewSettings: { ...base.viewSettings, forceLayout } });
		await flush();

		expect(h.layout.lastForceLayout).toEqual(forceLayout);
	});

	it("WHEN the next graph's node set changed THEN elk layout runs again (relayout)", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("n1.md", "n2.md"));
		await flush();

		h.controller.handleActiveFileChanged("b.md"); // adds n3 → structural change
		h.source.resolveBuild(1, graphOf("n1.md", "n2.md", "n3.md"));
		await flush();

		expect(h.layout.callCount).toBe(2);
	});
});

describe("GraphViewController committed-resize fit (ticket nid_9ep12hkmk4zjv2p28emmrhieq_e)", () => {
	// The CONTROLLER half of the fit rule: `decideLayout` can only answer the
	// geometry question if the controller hands it the layout it is holding. Passing
	// an empty one instead would make every fit answer "no" and silently collapse
	// this feature back into "a resize always relayouts" — with no other unit test
	// noticing, because the pure ones supply their own geometry.
	//
	// FakeLayout places root children at x = index * 200, y = 0, so "a.md" sits at
	// the origin with "b.md" 200px to its right. Both boxes are pinned by overrides,
	// so the numbers below ARE the geometry the fit rule judges.
	const NEIGHBOUR_LEFT_EDGE_PX = 200;
	const FITTING_WIDTH_PX = 150;
	const COLLIDING_WIDTH_PX = NEIGHBOUR_LEFT_EDGE_PX + 50;

	function graphResizedTo(widthPx: number): VicinityGraph {
		return makeGraph({
			nodes: [
				makeNode({
					path: asVaultPath("a.md"),
					override: { sizePx: { widthPx, heightPx: 100 } },
				}),
				makeNode({
					path: asVaultPath("b.md"),
					override: { sizePx: { widthPx: 100, heightPx: 100 } },
				}),
			],
			edges: [makeEdge("a.md", "b.md")],
		});
	}

	/** GIVEN a rendered graph, WHEN "a.md" commits `widthPx` and the view rebuilds. */
	async function afterResizeCommit(widthPx: number): Promise<Harness> {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphResizedTo(100));
		await flush();

		h.controller.handleSettingsChanged(); // the commit-on-release rebuild
		h.source.resolveBuild(1, graphResizedTo(widthPx));
		await flush();
		return h;
	}

	it("WHEN the committed box still clears its neighbour THEN elk is not re-run", async () => {
		expect((await afterResizeCommit(FITTING_WIDTH_PX)).layout.callCount).toBe(1);
	});

	it("WHEN the committed box overlaps its neighbour THEN elk runs again", async () => {
		expect((await afterResizeCommit(COLLIDING_WIDTH_PX)).layout.callCount).toBe(2);
	});
});

describe("GraphViewController outline data refresh", () => {
	const EDITED_OUTLINE: readonly OutlineEntry[] = [{ rawText: "Intro", level: 1 }];

	/** The same single-node graph, differing ONLY in the note's headings. */
	function graphWithOutline(outline: readonly OutlineEntry[]): VicinityGraph {
		return makeGraph({ nodes: [makeNode({ path: asVaultPath("a.md"), outline })] });
	}

	/** GIVEN a rendered graph, WHEN its note's headings are edited and it rebuilds. */
	async function afterHeadingsEdited(): Promise<Harness> {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphWithOutline([]));
		await flush();

		h.controller.handleSettingsChanged(); // rebuild with an identical id-set
		h.source.resolveBuild(1, graphWithOutline(EDITED_OUTLINE));
		await flush();
		return h;
	}

	it("THEN elk layout is not re-run (an outline change never forces a relayout)", async () => {
		expect((await afterHeadingsEdited()).layout.callCount).toBe(1);
	});

	it("THEN the snapshot published off the reused layout carries the NEW outline", async () => {
		const h = await afterHeadingsEdited();
		expect(noteNode(h.snapshot().nodes, "a.md")?.data.outline).toEqual(EDITED_OUTLINE);
	});
});

describe("GraphViewController step-05 snapshot extras", () => {
	/** GIVEN a graph whose notes/ folder groups and whose gone/ folder was fully truncated. */
	function richGraph(): VicinityGraph {
		return makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes") }),
			],
			edges: [makeEdge("notes/a.md", "notes/b.md")],
			hiddenNodeCountsByFolder: new Map([[asFolderPath("gone"), 2]]),
		});
	}

	async function readySnapshot(): Promise<FlowSnapshot> {
		const h = setup();
		h.controller.handleActiveFileChanged("notes/a.md");
		h.source.resolveBuild(0, richGraph());
		await flush();
		return h.snapshot();
	}

	it("WHEN a grouped folder renders THEN the snapshot contains its folder-group node", async () => {
		expect(nodeIds(await readySnapshot())).toContain("folder-group:notes");
	});

	it("WHEN a fully truncated folder exists THEN the snapshot carries the orphan overlay data", async () => {
		expect((await readySnapshot()).orphanTruncation).toEqual({
			totalHiddenCount: 2,
			breakdown: [{ folder: "gone", hiddenCount: 2 }],
		});
	});

	it("WHEN a folder-group node is clicked THEN no note open is attempted", () => {
		const h = setup();
		h.controller.openNode("folder-group:notes");
		expect(h.navigator.opened).toEqual([]);
	});
});

describe("GraphViewController layoutVersion refit signal", () => {
	it("WHEN the first build lays out THEN layoutVersion becomes 1", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("n1.md", "n2.md"));
		await flush();

		expect(h.snapshot().layoutVersion).toBe(1);
	});

	it("WHEN a rebuild reuses the layout THEN layoutVersion is unchanged (no refit)", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("n1.md", "n2.md"));
		await flush();

		h.controller.handleSettingsChanged(); // identical id-set → reuse-layout
		h.source.resolveBuild(1, graphOf("n1.md", "n2.md"));
		await flush();

		expect(h.snapshot().layoutVersion).toBe(1);
	});

	it("WHEN a rebuild changes structure THEN layoutVersion increments (refit)", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("n1.md", "n2.md"));
		await flush();

		h.controller.handleActiveFileChanged("b.md"); // adds n3 → relayout
		h.source.resolveBuild(1, graphOf("n1.md", "n2.md", "n3.md"));
		await flush();

		expect(h.snapshot().layoutVersion).toBe(2);
	});

	it("WHEN the snapshot goes empty and a new graph lays out THEN layoutVersion stays monotonic", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("n1.md"));
		await flush();

		h.controller.handleActiveFileChanged("gone.md");
		h.source.resolveBuild(1, null); // empty gap
		await flush();
		h.controller.handleActiveFileChanged("b.md");
		h.source.resolveBuild(2, graphOf("n2.md"));
		await flush();

		expect(h.snapshot().layoutVersion).toBe(2);
	});
});

describe("GraphViewController structural-diff skip rate", () => {
	/** Content-only rebuilds of the SAME node/edge id-set — the reuse-layout path. */
	const CONTENT_ONLY_REBUILDS = 5;

	it("WHEN structure is unchanged across repeated rebuilds THEN elk runs exactly once (skipped every time after)", async () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("n1.md", "n2.md"));
		await flush();

		// Each settings change rebuilds MAIN immediately with an identical id-set;
		// decideLayout must return reuse-layout every time, so elk never re-runs.
		for (let i = 0; i < CONTENT_ONLY_REBUILDS; i++) {
			h.controller.handleSettingsChanged();
			h.source.resolveBuild(i + 1, graphOf("n1.md", "n2.md"));
			await flush();
		}

		expect(h.layout.callCount).toBe(1);
	});
});

describe("GraphViewController edge-routing pass", () => {
	function edgeById(snapshot: FlowSnapshot, id: string): FlowSnapshot["edges"][number] {
		const edge = snapshot.edges.find((candidate) => candidate.id === id);
		if (edge === undefined) {
			throw new Error(`no edge ${id} in snapshot`);
		}
		return edge;
	}

	it("WHEN routing succeeds THEN the route lands on the matching edge's routedPoints", async () => {
		const route = [
			{ x: 1, y: 2 },
			{ x: 3, y: 4 },
		];
		const router = new FakeEdgeRouter(new Map([["c.md->n1.md", route]]));
		const h = setup(router);
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md", "n2.md"));
		await flush();

		expect(edgeById(h.snapshot(), "c.md->n1.md").routedPoints).toEqual(route);
	});

	it("WHEN a route ends inside its endpoint boxes THEN the attached routedPoints are clipped to those box borders", async () => {
		// FakeLayout places notes as 100px squares at x = index*200, y = 0: central
		// c.md → box [0..100]x[0..100] (centre 50,50), n1.md → box [200..300]x[0..100]
		// (centre 250,50). A straight route between the two CENTRES must clip to the
		// facing borders (x=100 on the source, x=200 on the target).
		const centreToCentre = [
			{ x: 50, y: 50 },
			{ x: 250, y: 50 },
		];
		const router = new FakeEdgeRouter(new Map([["c.md->n1.md", centreToCentre]]));
		const h = setup(router);
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		expect(edgeById(h.snapshot(), "c.md->n1.md").routedPoints).toEqual([
			{ x: 100, y: 50 },
			{ x: 200, y: 50 },
		]);
	});

	/**
	 * A central root note linking into a 2-member `notes` folder that renders as ONE
	 * collapsed group box. The engine edge c.md→notes/a.md collapses to the group
	 * edge `c.md->folder-group:notes` — the HEADLINE scenario this ticket clips.
	 */
	function collapsedGroupGraph(): VicinityGraph {
		return makeGraph({
			nodes: [
				makeNode({ path: asVaultPath("c.md") }),
				makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") }),
				makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes") }),
			],
			edges: [makeEdge("c.md", "notes/a.md")],
		});
	}

	it("WHEN a collapsed edge's route ends at the GROUP box centre THEN its terminus is clipped to the group boundary, not inside it", async () => {
		// FakeLayout lays the `notes` folder-group container out at index 0 → box
		// [0..150]x[0..100] (150px wide, centre 75,50, sized from groupDimensions) and
		// the ungrouped central c.md at index 1 → box [200..300]x[0..100] (centre 250,50).
		// The raw route runs from c.md's centre THROUGH the group interior to the group
		// centre; clipping must pull the group-side terminus back to the group's right
		// edge (x=150), never leaving it at the interior centre (x=75).
		const throughGroupInterior = [
			{ x: 250, y: 50 }, // c.md centre (source end)
			{ x: 100, y: 50 }, // inside the group box
			{ x: 75, y: 50 }, // group centre (target end)
		];
		const router = new FakeEdgeRouter(new Map([["c.md->folder-group:notes", throughGroupInterior]]));
		const h = setup(router);
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, collapsedGroupGraph());
		await flush();

		expect(edgeById(h.snapshot(), "c.md->folder-group:notes").routedPoints).toEqual([
			{ x: 200, y: 50 }, // clipped to c.md's left border (source)
			{ x: 150, y: 50 }, // clipped to the GROUP's right border (target), not the interior 75
		]);
	});

	it("WHEN an edge is absent from the route map THEN its routedPoints stays undefined", async () => {
		const router = new FakeEdgeRouter(new Map([["c.md->n1.md", [{ x: 1, y: 2 }]]]));
		const h = setup(router);
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md", "n2.md"));
		await flush();

		expect(edgeById(h.snapshot(), "c.md->n2.md").routedPoints).toBeUndefined();
	});

	it("WHEN the router throws THEN edges publish without routedPoints (straight-edge fallback)", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const h = setup(new FakeEdgeRouter(new Error("wasm boom")));
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		expect(edgeById(h.snapshot(), "c.md->n1.md").routedPoints).toBeUndefined();
		warn.mockRestore();
	});

	it("WHEN the router throws on repeated rebuilds THEN it warns exactly once", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const h = setup(new FakeEdgeRouter(new Error("wasm boom")));
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		h.controller.handleActiveFileChanged("d.md"); // different structure → relayout → routes again → throws again
		h.source.resolveBuild(1, graphOf("d.md", "n1.md", "n2.md"));
		await flush();

		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it("WHEN a later rebuild fails with a DIFFERENT error THEN that new failure warns too", async () => {
		// The whole point of dedup-by-signature: a structurally different cause (dead wasm
		// module vs. contract violation) must never be swallowed by an earlier failure.
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const router = new FakeEdgeRouter(new Error("wasm boom"));
		const h = setup(router);
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		router.setResponse(new Error("edge d.md->n1.md references an obstacle with no registered shape"));
		h.controller.handleActiveFileChanged("d.md");
		h.source.resolveBuild(1, graphOf("d.md", "n1.md", "n2.md"));
		await flush();

		expect(warn).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});

	it("WHEN a later rebuild fails with an equal-but-distinct Error instance THEN it stays silent (dedup is by signature, not identity)", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const router = new FakeEdgeRouter(new Error("wasm boom"));
		const h = setup(router);
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		router.setResponse(new Error("wasm boom")); // same name+message, different object
		h.controller.handleActiveFileChanged("d.md");
		h.source.resolveBuild(1, graphOf("d.md", "n1.md", "n2.md"));
		await flush();

		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it("WHEN the router throws a non-Error value THEN it still warns (no .name/.message assumed)", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const h = setup(new FakeEdgeRouter(new NonErrorThrow("wasm module unavailable")));
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it("WHEN the router throws a non-Error value THEN edges still fall back to straight", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const h = setup(new FakeEdgeRouter(new NonErrorThrow(undefined)));
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		expect(edgeById(h.snapshot(), "c.md->n1.md").routedPoints).toBeUndefined();
		warn.mockRestore();
	});

	// `String(Object.create(null))` genuinely throws (no `toString`, no `Symbol.toPrimitive`),
	// so these two exercise the UNSTRINGIFIABLE_FAILURE_SIGNATURE fallback. Without that
	// guard the signature derivation throws OUT of the catch block and the rebuild breaks
	// instead of degrading — i.e. both assertions below would fail.
	it("WHEN the router throws an unstringifiable value THEN the reporter still warns instead of throwing", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const h = setup(new FakeEdgeRouter(new NonErrorThrow(Object.create(null))));
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it("WHEN the router throws an unstringifiable value THEN edges still fall back to straight", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const h = setup(new FakeEdgeRouter(new NonErrorThrow(Object.create(null))));
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		expect(edgeById(h.snapshot(), "c.md->n1.md").routedPoints).toBeUndefined();
		warn.mockRestore();
	});

	it("WHEN a reuse-layout rebuild has unchanged inputs THEN routes are cached (router invoked once)", async () => {
		const router = new FakeEdgeRouter(new Map([["c.md->n1.md", [{ x: 1, y: 2 }]]]));
		const h = setup(router);
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		h.controller.handleSettingsChanged(); // identical id-set → reuse-layout, unchanged routing inputs
		h.source.resolveBuild(1, graphOf("c.md", "n1.md"));
		await flush();

		expect(h.router.callCount).toBe(1);
	});

	/** A graph whose resolved "Edge clearance" is a NON-default value inside the slider range. */
	function withClearance(graph: VicinityGraph, edgeRoutingClearancePx: number): VicinityGraph {
		const forceLayout = { ...EngineDefaults.forceLayoutSettings(), edgeRoutingClearancePx };
		return { ...graph, viewSettings: { ...graph.viewSettings, forceLayout } };
	}

	it("WHEN a build routes THEN the graph's resolved edge-routing clearance reaches the router", async () => {
		// The clearance is a SETTING (edge-routing__06 item (b)), no longer a module
		// constant: if it does not travel in the routing input the slider is dead and
		// libavoid keeps routing at its own default.
		const NON_DEFAULT_CLEARANCE_PX = 7;
		const h = setup(new FakeEdgeRouter(new Map()));
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, withClearance(graphOf("c.md", "n1.md"), NON_DEFAULT_CLEARANCE_PX));
		await flush();

		expect(h.router.lastInput?.shapeBufferPx).toBe(NON_DEFAULT_CLEARANCE_PX);
	});

	it("WHEN only the edge-routing clearance changed THEN the router runs again (the cache signature covers it)", async () => {
		// THE cache trap: `routingSignature` hashes obstacle geometry + edge endpoints,
		// and both rebuilds below produce identical geometry. With the clearance outside
		// the signature the second rebuild serves STALE routes and the slider looks dead.
		const CLEARANCE_BEFORE_PX = 7;
		const CLEARANCE_AFTER_PX = 13;
		const router = new FakeEdgeRouter(new Map([["c.md->n1.md", [{ x: 1, y: 2 }]]]));
		const h = setup(router);
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, withClearance(graphOf("c.md", "n1.md"), CLEARANCE_BEFORE_PX));
		await flush();

		h.controller.handleSettingsChanged(); // same id-set and same positions → same obstacles
		h.source.resolveBuild(1, withClearance(graphOf("c.md", "n1.md"), CLEARANCE_AFTER_PX));
		await flush();

		expect(h.router.callCount).toBe(2);
	});

	it("WHEN a reuse-layout rebuild reuses cached routes THEN the edge still carries them", async () => {
		const route = [{ x: 1, y: 2 }];
		const router = new FakeEdgeRouter(new Map([["c.md->n1.md", route]]));
		const h = setup(router);
		h.controller.handleActiveFileChanged("c.md");
		h.source.resolveBuild(0, graphOf("c.md", "n1.md"));
		await flush();

		h.controller.handleSettingsChanged();
		h.source.resolveBuild(1, graphOf("c.md", "n1.md"));
		await flush();

		expect(edgeById(h.snapshot(), "c.md->n1.md").routedPoints).toEqual(route);
	});
});

/**
 * The debounced metadata-resolve path (typing bursts). Driven with FAKE timers
 * so the 500ms window is deterministic and instant. Only setTimeout/clearTimeout
 * are faked — `flush()`'s setImmediate stays real so the async rebuild pipeline
 * still drains. `window` is aliased to the global timers because the controller
 * debounces via `window.setTimeout` and the node test env has no `window`.
 */
describe("GraphViewController metadata-resolve debounce", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		vi.stubGlobal("window", globalThis);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	/** Brings the controller to a rendered MAIN so subsequent rebuilds are measurable. */
	async function withMain(h: Harness): Promise<void> {
		h.controller.handleActiveFileChanged("a.md"); // immediate build[0]
		h.source.resolveBuild(0, graphOf("a.md"));
		await flush();
	}

	/** Fires N resolve events, each landing INSIDE the still-open window (restarting the timer). */
	function burstWithinWindow(h: Harness, count: number): void {
		for (let i = 0; i < count; i++) {
			h.controller.handleMetadataResolved();
			vi.advanceTimersByTime(REBUILD_DEBOUNCE_MS - 100); // < window: never fires here
		}
	}

	it("WHEN resolve events fire repeatedly within the window THEN no rebuild has fired yet (coalesced)", async () => {
		const h = setup();
		await withMain(h);

		burstWithinWindow(h, 5);

		expect(h.source.calls).toEqual(["a.md"]); // only the initial build; burst still pending
	});

	it("WHEN the window finally elapses after a burst THEN exactly one coalesced rebuild fires", async () => {
		const h = setup();
		await withMain(h);
		burstWithinWindow(h, 5);

		vi.advanceTimersByTime(REBUILD_DEBOUNCE_MS); // let the last armed timer complete

		expect(h.source.calls).toEqual(["a.md", "a.md"]); // initial + one, not five
	});

	it("WHEN an active-file change arrives with a resolve pending THEN it rebuilds immediately", async () => {
		const h = setup();
		await withMain(h);
		h.controller.handleMetadataResolved(); // arm the debounce

		h.controller.handleActiveFileChanged("b.md"); // no timer advance below

		expect(h.source.calls).toEqual(["a.md", "b.md"]);
	});

	it("WHEN an active-file change supersedes a pending resolve THEN the pending debounce never fires", async () => {
		const h = setup();
		await withMain(h);
		h.controller.handleMetadataResolved();
		h.controller.handleActiveFileChanged("b.md"); // clears the pending debounce

		vi.advanceTimersByTime(REBUILD_DEBOUNCE_MS * 2);

		expect(h.source.calls).toEqual(["a.md", "b.md"]); // no stray third build
	});

	it("WHEN a settings change supersedes a pending resolve THEN the pending debounce never fires", async () => {
		const h = setup();
		await withMain(h);
		h.controller.handleMetadataResolved();
		h.controller.handleSettingsChanged(); // immediate + clears the pending debounce

		vi.advanceTimersByTime(REBUILD_DEBOUNCE_MS * 2);

		expect(h.source.calls).toEqual(["a.md", "a.md"]); // the settings rebuild only
	});
});

describe("GraphViewController node focus", () => {
	/** GIVEN a rendered graph centered on a.md with neighbour b.md. */
	async function focusHarness(): Promise<Harness> {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		h.source.resolveBuild(0, graphOf("a.md", "b.md"));
		await flush();
		return h;
	}

	it("WHEN a node is focused THEN a rebuild centered on that node starts", async () => {
		const h = await focusHarness();

		h.controller.focusNode("b.md");

		expect(h.source.calls).toEqual(["a.md", "b.md"]);
	});

	it("WHEN a node is focused THEN its note opens in the editor", async () => {
		const h = await focusHarness();

		h.controller.focusNode("b.md");

		expect(h.navigator.opened).toEqual(["b.md"]);
	});

	it("WHEN a node is focused THEN the note reuses the current tab (no new tab)", async () => {
		const h = await focusHarness();

		h.controller.focusNode("b.md");

		expect(h.navigator.openedOptions).toEqual([{ newTab: false }]);
	});

	it("WHEN the current MAIN node is focused THEN no rebuild starts", async () => {
		const h = await focusHarness();

		h.controller.focusNode("a.md");

		expect(h.source.calls).toEqual(["a.md"]);
	});

	it("WHEN the current MAIN node is focused THEN its note is NOT re-opened", async () => {
		const h = await focusHarness();

		h.controller.focusNode("a.md");

		expect(h.navigator.opened).toEqual([]);
	});

	it("WHEN a folder-group id is focused THEN no rebuild starts", async () => {
		const h = await focusHarness();

		h.controller.focusNode("folder-group:sub");

		expect(h.source.calls).toEqual(["a.md"]);
	});

	it("WHEN a folder-group id is focused THEN no note opens", async () => {
		const h = await focusHarness();

		h.controller.focusNode("folder-group:sub");

		expect(h.navigator.opened).toEqual([]);
	});

	it("WHEN the active file later changes to the focused path THEN the change is a no-op", async () => {
		const h = await focusHarness();
		h.controller.focusNode("b.md");
		h.source.resolveBuild(1, graphOf("b.md", "a.md"));
		await flush();

		h.controller.handleActiveFileChanged("b.md");

		expect(h.source.calls).toEqual(["a.md", "b.md"]);
	});
});

describe("GraphViewController link previews", () => {
	const OCCURRENCES = new FakeLinkOccurrenceProvider({
		outgoing: {
			"a.md": [
				{ targetPath: asVaultPath("b.md"), offset: 3, context: null },
				{ targetPath: asVaultPath("c.md"), offset: 9, context: null },
			],
		},
	});

	/** GIVEN a rendered graph where a.md links b.md and c.md. */
	async function renderedHarness(): Promise<Harness> {
		const h = setup(new FakeEdgeRouter(), OCCURRENCES);
		h.controller.handleActiveFileChanged("a.md");
		const nodes = [
			makeNode({ path: asVaultPath("a.md") }),
			makeNode({ path: asVaultPath("b.md") }),
			makeNode({ path: asVaultPath("c.md") }),
		];
		const edges = [makeEdge("a.md", "b.md"), makeEdge("a.md", "c.md")];
		h.source.resolveBuild(0, makeGraph({ nodes, edges }));
		await flush();
		return h;
	}

	it("WHEN an edge preview opens THEN the seam shows the edge-scoped occurrences only", async () => {
		const h = await renderedHarness();

		await h.controller.openEdgePreview("a.md->b.md");

		expect(h.linkPreview.shown).toMatchObject([
			{
				sourceName: "a",
				targetName: "b",
				pairs: [{ sourcePath: "a.md", targetPath: "b.md", rows: [{ occurrence: { offset: 3 } }] }],
			},
		]);
	});

	it("WHEN the clicked edge id is not in the rendered graph THEN nothing is shown", async () => {
		const h = await renderedHarness();

		await h.controller.openEdgePreview("ghost.md->b.md");

		expect(h.linkPreview.shown).toEqual([]);
	});

	/**
	 * GIVEN a rendered graph where hub.md fans into BOTH members of the 2-member
	 * `notes` folder — the fan renders as ONE collapsed edge
	 * `hub.md->folder-group:notes` (ticket `nid_tiitgrp5bt7g2niwcvthxw1jk_e`).
	 */
	async function collapsedEdgeHarness(): Promise<Harness> {
		const occurrences = new FakeLinkOccurrenceProvider({
			outgoing: {
				"hub.md": [
					{ targetPath: asVaultPath("notes/a.md"), offset: 3, context: null },
					{ targetPath: asVaultPath("notes/b.md"), offset: 9, context: null },
				],
			},
		});
		const h = setup(new FakeEdgeRouter(), occurrences);
		h.controller.handleActiveFileChanged("hub.md");
		const nodes = [
			makeNode({ path: asVaultPath("hub.md") }),
			makeNode({ path: asVaultPath("notes/a.md"), folder: asFolderPath("notes") }),
			makeNode({ path: asVaultPath("notes/b.md"), folder: asFolderPath("notes") }),
		];
		const edges = [makeEdge("hub.md", "notes/a.md"), makeEdge("hub.md", "notes/b.md")];
		h.source.resolveBuild(0, makeGraph({ nodes, edges }));
		await flush();
		return h;
	}

	it("WHEN a collapsed group edge preview opens THEN the model groups occurrences per contributing note pair", async () => {
		const h = await collapsedEdgeHarness();

		await h.controller.openEdgePreview("hub.md->folder-group:notes");

		expect(h.linkPreview.shown).toMatchObject([
			{
				pairs: [
					{ sourcePath: "hub.md", targetPath: "notes/a.md", rows: [{ occurrence: { offset: 3 } }] },
					{ sourcePath: "hub.md", targetPath: "notes/b.md", rows: [{ occurrence: { offset: 9 } }] },
				],
			},
		]);
	});

	it("WHEN a collapsed group edge preview opens THEN the endpoint names are the note title and the folder name", async () => {
		const h = await collapsedEdgeHarness();

		await h.controller.openEdgePreview("hub.md->folder-group:notes");

		expect(h.linkPreview.shown).toMatchObject([{ sourceName: "hub", targetName: "notes" }]);
	});
});
