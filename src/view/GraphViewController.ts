import type { LayoutMode, VicinityGraph } from "../engine";
import { EngineDefaults } from "../engine";
import type { ControlsModel } from "./ControlsModel";
import { REBUILD_DEBOUNCE_MS, SIZE_RELAYOUT_THRESHOLD } from "./constants";
import { decideLayout } from "./GraphStructureDiff";
import { decideActiveFileRebuild } from "./RebuildDecision";
import { vicinityGraphToElk, extractElkDimensionsById, extractElkPositions } from "./elkMapping";
import { vicinityGraphToFlow, withGroupDimensions, withPositions } from "./flowMapping";
import type { Dimensions, FlowEdge, FlowGraph, FlowNode, XY } from "./flowMapping";
import { clipRouteToEndpointRects } from "./edgeGeometry";
import { extractEdgeRoutingInput } from "./edgeRouting";
import type { EdgeRouteMap, EdgeRouter, EdgeRoutingInput, RoutedPoint } from "./edgeRouting";
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

/** Shared empty route map = every edge stays straight (routing off or failed). */
const EMPTY_ROUTES: EdgeRouteMap = new Map();

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
	/**
	 * Cached routed polylines keyed by a signature of the routing inputs
	 * (obstacles + edges). Reused when the signature is unchanged so a reuse-layout
	 * rebuild never re-runs libavoid; dropped on any input change or when routing is
	 * off (so a later edge-routing flip recomputes without forcing an elk relayout).
	 */
	private routeCache: { readonly signature: string; readonly routes: EdgeRouteMap } | null = null;
	/** The pass-level routing failure is logged at most once per controller — no per-rebuild spam. */
	private routingFailureWarned = false;

	constructor(
		private readonly navigator: NoteNavigatorPort,
		private readonly graphBuilder: GraphSourcePort,
		private readonly layoutRunner: GraphLayoutPort,
		private readonly edgeRouter: EdgeRouter,
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
		let positions: ReadonlyMap<string, XY>;
		let groupDimensions: ReadonlyMap<string, Dimensions>;
		if (decision === "reuse-layout") {
			// No structural change: keep positions and group sizes, refresh node data only.
			console.debug("vicinity-graph: structural diff skipped elk layout (data-only refresh)");
			positions = this.positions;
			groupDimensions = this.groupDimensions;
		} else {
			// Wall-time of the elk+d3 layout pass — the baseline the routing pass must
			// stay well under (edge-routing__03 item 3 perf budget). debug-level so it
			// is silent unless devtools verbose logging is enabled.
			const layoutStart = performance.now();
			const laidOut = await this.layoutRunner.layout(vicinityGraphToElk(graph));
			console.debug("vicinity-graph: elk+d3 layout pass", {
				nodeCount: graph.nodes.length,
				durationMs: performance.now() - layoutStart,
			});
			if (this.isStale(token)) {
				return;
			}
			this.layoutVersion += 1;
			positions = extractElkPositions(laidOut);
			groupDimensions = extractElkDimensionsById(laidOut);
		}
		// Route AFTER layout, BEFORE publish: obstacles need final absolute positions.
		const routes = await this.resolveRoutes(graph, flow, positions, groupDimensions, token);
		if (this.isStale(token)) {
			return;
		}
		this.publish(graph, positions, groupDimensions, withRoutedPoints(flow, routes));
	}

	/**
	 * Obstacle-avoiding routes for this build, or an empty map = straight edges.
	 * Gated by the `edgeRouting` view setting (OFF ⇒ router never invoked, wasm
	 * never loads). Caches by an input signature so a reuse-layout rebuild with
	 * unchanged obstacles/edges reuses the previous pass instead of re-running
	 * libavoid. A wasm-init/routing failure is contained here: warn ONCE, return
	 * empty (single documented pass-level fallback — no per-edge silent fallbacks).
	 */
	private async resolveRoutes(
		graph: VicinityGraph,
		flow: FlowGraph,
		positions: ReadonlyMap<string, XY>,
		groupDimensions: ReadonlyMap<string, Dimensions>,
		token: number,
	): Promise<EdgeRouteMap> {
		if (!graph.viewSettings.edgeRouting || isRoutingSkippedLayout(graph.viewSettings.layoutMode)) {
			this.routeCache = null;
			return EMPTY_ROUTES;
		}
		const input = extractEdgeRoutingInput({
			nodes: flow.nodes,
			edges: flow.edges,
			positions,
			groupDimensions,
		});
		const signature = routingSignature(input);
		if (this.routeCache !== null && this.routeCache.signature === signature) {
			return this.routeCache.routes;
		}
		try {
			// Wall-time of the obstacle-avoiding routing pass, with its input scale —
			// compared against the elk+d3 layout log above to hold the item-3 perf
			// budget (routing must stay well under layout). debug-level, silent by default.
			const routeStart = performance.now();
			const routes = await this.edgeRouter.route(input);
			console.debug("vicinity-graph: edge routing pass", {
				obstacleCount: input.obstacles.length,
				edgeCount: input.edges.length,
				durationMs: performance.now() - routeStart,
			});
			if (this.isStale(token)) {
				return EMPTY_ROUTES;
			}
			// Clip each route to its endpoint obstacle rects so arrows terminate ON the
			// box boundary (esp. a collapsed GROUP box), not at the centre pin libavoid
			// attaches connector endpoints to. Cache the CLIPPED routes so a reuse-layout
			// rebuild serves them straight from cache.
			const clippedRoutes = clipRoutesToObstacles(routes, input);
			this.routeCache = { signature, routes: clippedRoutes };
			return clippedRoutes;
		} catch (error: unknown) {
			if (!this.routingFailureWarned) {
				this.routingFailureWarned = true;
				console.warn("vicinity-graph: edge routing failed; rendering straight edges", error);
			}
			this.routeCache = null;
			return EMPTY_ROUTES;
		}
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

/**
 * Layout mode whose routing pass is intentionally SKIPPED. Radial ring placement
 * spreads nodes evenly around the hub so the spokes are already near-straight;
 * running obstacle-avoiding routing there still forces libavoid to build the full
 * ~100-obstacle visibility graph (~490ms on a dense `all-edges` vicinity, vs the
 * ~45ms radial layout) for no visual benefit. So radial edges render straight —
 * gated until a cheaper path exists (web-worker offload, deferred). Force + layered
 * still route (edge-routing__03, human decision).
 */
const ROUTING_SKIPPED_LAYOUT_MODE: LayoutMode = "radial";

function isRoutingSkippedLayout(layoutMode: LayoutMode): boolean {
	return layoutMode === ROUTING_SKIPPED_LAYOUT_MODE;
}

/** Field separator for the route-cache signature — a NUL cannot occur in a vault path / id. */
const ROUTE_SIGNATURE_SEPARATOR = "\u0000";

/**
 * A stable string over every routing input (obstacle geometry + edge endpoints).
 * Two builds with the same obstacles/edges produce the same signature, so the
 * route cache reuses the previous pass instead of re-running libavoid. Insertion
 * order is deterministic (flow node/edge order is stable for a given graph).
 */
function routingSignature(input: EdgeRoutingInput): string {
	const obstacles = input.obstacles.map(
		(o) => `${o.id}:${o.x},${o.y},${o.widthPx},${o.heightPx}`,
	);
	const edges = input.edges.map((e) => `${e.id}:${e.sourceId}->${e.targetId}`);
	return [obstacles.join(ROUTE_SIGNATURE_SEPARATOR), edges.join(ROUTE_SIGNATURE_SEPARATOR)].join(
		ROUTE_SIGNATURE_SEPARATOR,
	);
}

/**
 * Clips every routed polyline to its source/target obstacle rectangles so the
 * arrow terminates ON the endpoint boundary rather than at the box centre libavoid
 * pins connector endpoints to (see {@link clipRouteToEndpointRects}). An edge whose
 * source or target obstacle is missing is left UNCLIPPED (never dropped or crashed);
 * an empty route map is a no-op.
 */
function clipRoutesToObstacles(routes: EdgeRouteMap, input: EdgeRoutingInput): EdgeRouteMap {
	if (routes.size === 0) {
		return routes;
	}
	const obstacleById = new Map(input.obstacles.map((obstacle) => [obstacle.id, obstacle]));
	const clipped = new Map<string, readonly RoutedPoint[]>();
	for (const edge of input.edges) {
		const route = routes.get(edge.id);
		if (route === undefined) {
			continue;
		}
		const sourceRect = obstacleById.get(edge.sourceId);
		const targetRect = obstacleById.get(edge.targetId);
		if (sourceRect === undefined || targetRect === undefined) {
			clipped.set(edge.id, route);
			continue;
		}
		clipped.set(edge.id, clipRouteToEndpointRects(route, sourceRect, targetRect));
	}
	return clipped;
}

/**
 * Attaches routed polylines to the flow edges before publish. Edges absent from
 * the map keep straight rendering (no `routedPoints`); an empty map is a no-op.
 */
function withRoutedPoints(flow: FlowGraph, routes: EdgeRouteMap): FlowGraph {
	if (routes.size === 0) {
		return flow;
	}
	return {
		...flow,
		edges: flow.edges.map((edge) => {
			const routedPoints = routes.get(edge.id);
			return routedPoints === undefined ? edge : { ...edge, routedPoints };
		}),
	};
}
