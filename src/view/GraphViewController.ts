import type { VicinityGraph } from "../engine";
import { EngineDefaults } from "../engine";
import type { ControlsModel } from "./ControlsModel";
import { REBUILD_DEBOUNCE_MS, SIZE_RELAYOUT_THRESHOLD } from "./constants";
import { decideLayout } from "./GraphStructureDiff";
import { decideActiveFileRebuild } from "./RebuildDecision";
import { vicinityGraphToElk, extractElkDimensionsById, extractElkPositions } from "./elkMapping";
import { vicinityGraphToFlow, withGroupDimensions, withPositions } from "./flowMapping";
import type { Dimensions, FlowEdge, FlowGraph, FlowNode, XY } from "./flowMapping";
import { isFolderGroupId } from "./graphIdentity";
import { NO_ORPHAN_TRUNCATION } from "./truncationBadges";
import type { OrphanTruncation } from "./truncationBadges";
import type { GraphLayoutPort, GraphSourcePort, NoteNavigatorPort, OpenNoteOptions } from "./viewPorts";

/**
 * Owns the rebuild pipeline `events → engine → structural diff → elkjs →
 * React Flow` and exposes the result as an external store the React view
 * subscribes to. Deliberately the ONLY view class that touches Obsidian and the
 * async engine, so `VicinityGraphView.tsx` stays a thin lifecycle shell and
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
	/** Whether folder groups are rendered (the build's resolved view setting). */
	readonly groupByFolder: boolean;
	/** Graph-corner "+N hidden" overlay data (zero-total constant when nothing is hidden). */
	readonly orphanTruncation: OrphanTruncation;
	/** The toolbar's read-model for this build (MAIN + pinned centrals, empty when no graph). */
	readonly controls: ControlsModel;
	/**
	 * Monotonic counter bumped every time a publish carries FRESH elk positions
	 * (unchanged on reuse-layout data refreshes). The render layer refits the
	 * viewport on this signal — RF's own mount-only `fitView` neither refits
	 * after rebuilds nor survives Obsidian's pane-timing on mount.
	 */
	readonly layoutVersion: number;
}

const EMPTY_CONTROLS: ControlsModel = {
	centrals: [],
	mainPinned: false,
	globalDepths: EngineDefaults.depthSettings(),
	globalView: EngineDefaults.viewSettings(),
};

const EMPTY_SNAPSHOT: FlowSnapshot = {
	status: "empty",
	nodes: [],
	edges: [],
	groupByFolder: false,
	orphanTruncation: NO_ORPHAN_TRUNCATION,
	controls: EMPTY_CONTROLS,
	layoutVersion: 0,
};

type Subscriber = () => void;

export class GraphViewController {
	private snapshot: FlowSnapshot = EMPTY_SNAPSHOT;
	private readonly subscribers = new Set<Subscriber>();

	/** The graph rendered last — the structural-diff baseline. */
	private previousGraph: VicinityGraph | null = null;
	/** Positions of the currently rendered nodes, reused when layout is skipped. */
	private positions: ReadonlyMap<string, XY> = new Map();
	/** elk-computed folder-group sizes, reused alongside positions when layout is skipped. */
	private groupDimensions: ReadonlyMap<string, Dimensions> = new Map();
	/** Toolbar read-model from the last successful build, republished on every publish. */
	private controls: ControlsModel = EMPTY_CONTROLS;
	private mainPath: string | null = null;
	private rebuildToken = 0;
	private debounceTimer: number | null = null;
	/** Never reset — monotonicity lets the render layer diff it safely across empty gaps. */
	private layoutVersion = 0;

	constructor(
		private readonly navigator: NoteNavigatorPort,
		private readonly graphBuilder: GraphSourcePort,
		private readonly layoutRunner: GraphLayoutPort,
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
		// The active-file change already triggers a fresh rebuild below, so drop
		// any pending debounced resolve-rebuild — it would be a redundant second pass.
		this.clearDebounce();
		this.mainPath = outcome.mainPath;
		void this.runRebuild();
	}

	/**
	 * A settings write (toolbar stepper / settings tab) changed persisted state
	 * for the current MAIN. Not a file change, so this bypasses
	 * {@link decideActiveFileRebuild}; it drops any pending debounced resolve and
	 * rebuilds immediately (latest-wins {@link rebuildToken} absorbs stepper
	 * bursts, the executor already awaited the write). No-op when no MAIN is set.
	 */
	handleSettingsChanged(): void {
		this.clearDebounce();
		void this.runRebuild();
	}

	/** The current MAIN file path (pure string getter — the executor targets it). `null` before any build. */
	currentMainPath(): string | null {
		return this.mainPath;
	}

	/** Vault content changed while the view is open — debounce the resolve burst. */
	handleMetadataResolved(): void {
		this.clearDebounce();
		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = null;
			void this.runRebuild();
		}, REBUILD_DEBOUNCE_MS);
	}

	/** Open the note behind a clicked node in a main-area editor leaf
	 * (ctrl/cmd-click passes `{ newTab: true }` — CLARIFICATION Q2). */
	openNode(path: string, options?: OpenNoteOptions): void {
		if (isFolderGroupId(path)) {
			return; // Folder-group containers have no note behind them.
		}
		this.navigator.openNote(path, options);
	}

	// --- pipeline ----------------------------------------------------------

	private async runRebuild(): Promise<void> {
		const token = ++this.rebuildToken;
		const mainPath = this.mainPath;
		if (mainPath === null) {
			this.reset();
			return;
		}
		const result = await this.graphBuilder.build(mainPath);
		if (this.isStale(token)) {
			return;
		}
		if (result === null || result.graph.nodes.length === 0) {
			this.reset();
			return;
		}
		const graph = result.graph;
		this.controls = result.controls;
		const decision = decideLayout(this.previousGraph, graph, SIZE_RELAYOUT_THRESHOLD);
		const flow = vicinityGraphToFlow(graph, result.controls.mainPinned);
		if (decision === "reuse-layout") {
			// No structural change: keep positions and group sizes, refresh node data only.
			console.debug("vicinity-graph: structural diff skipped elk layout (data-only refresh)");
			this.publish(graph, this.positions, this.groupDimensions, flow);
			return;
		}
		const laidOut = await this.layoutRunner.layout(vicinityGraphToElk(graph));
		if (this.isStale(token)) {
			return;
		}
		this.layoutVersion += 1;
		this.publish(graph, extractElkPositions(laidOut), extractElkDimensionsById(laidOut), flow);
	}

	private isStale(token: number): boolean {
		return token !== this.rebuildToken;
	}

	private publish(
		graph: VicinityGraph,
		positions: ReadonlyMap<string, XY>,
		groupDimensions: ReadonlyMap<string, Dimensions>,
		flow: FlowGraph,
	): void {
		this.previousGraph = graph;
		this.positions = positions;
		this.groupDimensions = groupDimensions;
		this.setSnapshot({
			status: "ready",
			nodes: withGroupDimensions(withPositions(flow.nodes, positions), groupDimensions),
			edges: flow.edges,
			groupByFolder: flow.groupByFolder,
			orphanTruncation: flow.orphanTruncation,
			controls: this.controls,
			layoutVersion: this.layoutVersion,
		});
	}

	private reset(): void {
		this.previousGraph = null;
		this.positions = new Map();
		this.groupDimensions = new Map();
		this.controls = EMPTY_CONTROLS;
		this.setSnapshot(EMPTY_SNAPSHOT);
	}

	private setSnapshot(snapshot: FlowSnapshot): void {
		this.snapshot = snapshot;
		for (const listener of this.subscribers) {
			listener();
		}
	}

	private activeFilePath(): string | null {
		return this.navigator.activeFilePath();
	}

	private clearDebounce(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}
}
