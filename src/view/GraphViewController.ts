import type { App } from "obsidian";
import type { NeighborhoodGraph } from "../engine";
import type { NeighborhoodGraphBuilder } from "../adapters/NeighborhoodGraphBuilder";
import { REBUILD_DEBOUNCE_MS, SIZE_RELAYOUT_THRESHOLD } from "./constants";
import { decideLayout } from "./GraphStructureDiff";
import { decideActiveFileRebuild } from "./RebuildDecision";
import { neighborhoodGraphToElk, extractElkPositions } from "./elkMapping";
import { neighborhoodGraphToFlow, withPositions } from "./flowMapping";
import type { FlowEdge, FlowNode, XY } from "./flowMapping";
import type { ElkLayoutRunner } from "./ElkLayoutRunner";

/**
 * Owns the rebuild pipeline `events → engine → structural diff → elkjs →
 * React Flow` and exposes the result as an external store the React view
 * subscribes to. Deliberately the ONLY view class that touches Obsidian and the
 * async engine, so `NeighborhoodGraphView.tsx` stays a thin lifecycle shell and
 * every decision it makes lives in a pure, node-tested module.
 *
 * Concurrency: rebuilds are async (engine build + elk layout). A monotonic
 * {@link rebuildToken} implements latest-wins — a result whose token is stale
 * is discarded, so a rapid active-file switch mid-rebuild never renders an old
 * graph. No sleeps.
 */

export type FlowStatus = "empty" | "ready";

export interface FlowSnapshot {
	readonly status: FlowStatus;
	readonly nodes: readonly FlowNode[];
	readonly edges: readonly FlowEdge[];
}

const EMPTY_SNAPSHOT: FlowSnapshot = { status: "empty", nodes: [], edges: [] };

type Subscriber = () => void;

export class GraphViewController {
	private snapshot: FlowSnapshot = EMPTY_SNAPSHOT;
	private readonly subscribers = new Set<Subscriber>();

	/** The graph rendered last — the structural-diff baseline. */
	private previousGraph: NeighborhoodGraph | null = null;
	/** Positions of the currently rendered nodes, reused when layout is skipped. */
	private positions: ReadonlyMap<string, XY> = new Map();
	private mainPath: string | null = null;
	private rebuildToken = 0;
	private debounceTimer: number | null = null;

	constructor(
		private readonly app: App,
		private readonly graphBuilder: NeighborhoodGraphBuilder,
		private readonly layoutRunner: ElkLayoutRunner,
	) {}

	// --- external store (React `useSyncExternalStore`) ---------------------

	readonly subscribe = (listener: Subscriber): (() => void) => {
		this.subscribers.add(listener);
		return () => this.subscribers.delete(listener);
	};

	readonly getSnapshot = (): FlowSnapshot => this.snapshot;

	// --- lifecycle ---------------------------------------------------------

	/** Kick off the first rebuild from whatever file is active when the view opens. */
	start(): void {
		this.handleActiveFileChanged(this.activeFilePath());
	}

	/** Cancel any pending debounced rebuild. Obsidian events are unregistered by the ItemView. */
	dispose(): void {
		this.clearDebounce();
	}

	// --- event entry points (called by the ItemView) -----------------------

	handleActiveFileChanged(activePath: string | null): void {
		const outcome = decideActiveFileRebuild(activePath, this.mainPath);
		if (outcome.kind === "ignore") {
			return;
		}
		this.mainPath = outcome.mainPath;
		void this.runRebuild();
	}

	/** Vault content changed while the view is open — debounce the resolve burst. */
	handleMetadataResolved(): void {
		this.clearDebounce();
		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = null;
			void this.runRebuild();
		}, REBUILD_DEBOUNCE_MS);
	}

	/** Open the note behind a clicked node in the active tab. */
	openNode(path: string): void {
		const file = this.app.vault.getFileByPath(path);
		if (file === null) {
			return;
		}
		void this.app.workspace.getLeaf(false).openFile(file);
	}

	// --- pipeline ----------------------------------------------------------

	private async runRebuild(): Promise<void> {
		const token = ++this.rebuildToken;
		const mainPath = this.mainPath;
		if (mainPath === null) {
			this.reset();
			return;
		}
		const graph = await this.graphBuilder.build(mainPath);
		if (this.isStale(token)) {
			return;
		}
		if (graph === null || graph.nodes.length === 0) {
			this.reset();
			return;
		}
		const decision = decideLayout(this.previousGraph, graph, SIZE_RELAYOUT_THRESHOLD);
		const flow = neighborhoodGraphToFlow(graph);
		if (decision === "reuse-layout") {
			// No structural change: keep positions, refresh node data only.
			console.debug("neighborhood-graph: structural diff skipped elk layout (data-only refresh)");
			this.publish(graph, this.positions, withPositions(flow.nodes, this.positions), flow.edges);
			return;
		}
		const laidOut = await this.layoutRunner.layout(neighborhoodGraphToElk(graph));
		if (this.isStale(token)) {
			return;
		}
		const positions = extractElkPositions(laidOut);
		this.publish(graph, positions, withPositions(flow.nodes, positions), flow.edges);
	}

	private isStale(token: number): boolean {
		return token !== this.rebuildToken;
	}

	private publish(
		graph: NeighborhoodGraph,
		positions: ReadonlyMap<string, XY>,
		nodes: readonly FlowNode[],
		edges: readonly FlowEdge[],
	): void {
		this.previousGraph = graph;
		this.positions = positions;
		this.setSnapshot({ status: "ready", nodes, edges });
	}

	private reset(): void {
		this.previousGraph = null;
		this.positions = new Map();
		this.setSnapshot(EMPTY_SNAPSHOT);
	}

	private setSnapshot(snapshot: FlowSnapshot): void {
		this.snapshot = snapshot;
		for (const listener of this.subscribers) {
			listener();
		}
	}

	private activeFilePath(): string | null {
		return this.app.workspace.getActiveFile()?.path ?? null;
	}

	private clearDebounce(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}
}
