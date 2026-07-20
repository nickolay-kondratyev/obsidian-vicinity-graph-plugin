import { describe, expect, it } from "vitest";
import type { ElkNode } from "elkjs";
import type { NeighborhoodGraph } from "../engine";
import { asFolderPath, asVaultPath, EngineDefaults } from "../engine";
import { GraphViewController } from "./GraphViewController";
import type { FlowSnapshot } from "./GraphViewController";
import type { ControlsModel } from "./ControlsModel";
import type { GraphBuildResult, GraphLayoutPort, GraphSourcePort, NoteNavigatorPort, OpenNoteOptions } from "./viewPorts";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

/** These tests exercise rebuild concurrency, not the toolbar model — an empty model suffices. */
const EMPTY_CONTROLS: ControlsModel = {
	centrals: [],
	globalDepths: EngineDefaults.depthSettings(),
	globalView: EngineDefaults.viewSettings(),
};

/**
 * Controller orchestration tests: latest-wins concurrency, null/empty handling,
 * MAIN gating, and the structural-diff skip/relayout branches. All collaborators
 * are plain structural fakes (no obsidian runtime mock, no React, no elk mounted).
 * Rebuilds are driven by resolving DEFERRED build promises in a chosen order —
 * concurrency is controlled explicitly, never by sleeps or timers. The debounced
 * metadata-resolve path is intentionally out of scope (it needs `window`).
 */

interface Deferred<T> {
	readonly promise: Promise<T>;
	resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
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
	resolveBuild(index: number, graph: NeighborhoodGraph | null): void {
		const pending = this.deferreds[index];
		if (pending === undefined) {
			throw new Error(`no pending build at index ${index}`);
		}
		pending.resolve(graph === null ? null : { graph, controls: EMPTY_CONTROLS });
	}
}

/** Lays children out at deterministic, distinct coordinates and counts invocations. */
class FakeLayout implements GraphLayoutPort {
	callCount = 0;

	async layout(graph: ElkNode): Promise<ElkNode> {
		this.callCount += 1;
		const children = (graph.children ?? []).map((child, index) => ({ ...child, x: index * 200, y: 0 }));
		return { ...graph, children };
	}
}

class FakeNavigator implements NoteNavigatorPort {
	readonly opened: string[] = [];
	readonly openedOptions: (OpenNoteOptions | undefined)[] = [];
	activePath: string | null = null;

	activeFilePath(): string | null {
		return this.activePath;
	}

	openNote(path: string, options?: OpenNoteOptions): void {
		this.opened.push(path);
		this.openedOptions.push(options);
	}
}

interface Harness {
	readonly controller: GraphViewController;
	readonly source: FakeGraphSource;
	readonly layout: FakeLayout;
	readonly navigator: FakeNavigator;
	snapshot(): FlowSnapshot;
}

function setup(): Harness {
	const source = new FakeGraphSource();
	const layout = new FakeLayout();
	const navigator = new FakeNavigator();
	const controller = new GraphViewController(navigator, source, layout);
	return { controller, source, layout, navigator, snapshot: () => controller.getSnapshot() };
}

function nodeIds(snapshot: FlowSnapshot): string[] {
	return snapshot.nodes.map((node) => node.id);
}

/** A graph whose first path is central and the rest are edge-linked neighbours. */
function graphOf(centralPath: string, ...neighbourPaths: string[]): NeighborhoodGraph {
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

		expect(h.snapshot().status).toBe("empty");
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

	it("WHEN no MAIN is set THEN currentMainPath is null", () => {
		const h = setup();
		expect(h.controller.currentMainPath()).toBeNull();
	});

	it("WHEN a MAIN file is active THEN currentMainPath returns it", () => {
		const h = setup();
		h.controller.handleActiveFileChanged("a.md");
		expect(h.controller.currentMainPath()).toBe("a.md");
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

describe("GraphViewController step-05 snapshot extras", () => {
	/** GIVEN a graph whose notes/ folder groups and whose gone/ folder was fully truncated. */
	function richGraph(): NeighborhoodGraph {
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

	it("WHEN a build renders THEN the snapshot forwards the resolved groupByFolder flag", async () => {
		expect((await readySnapshot()).groupByFolder).toBe(true);
	});

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
