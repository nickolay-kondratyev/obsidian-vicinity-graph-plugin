import type { LinkOccurrenceProvider, VicinityGraph } from "../engine";
import { asVaultPath, EngineDefaults } from "../engine";
import type { ControlsModel } from "./ControlsModel";
import { REBUILD_DEBOUNCE_MS, SIZE_RELAYOUT_THRESHOLD } from "./constants";
import { decideLayout } from "./GraphStructureDiff";
import { decideActiveFileRebuild } from "./RebuildDecision";
import { vicinityGraphToElk, extractElkDimensionsById, extractElkPositions } from "./elkMapping";
import { vicinityGraphToFlow, withGroupDimensions, withPositions } from "./flowMapping";
import type { Dimensions, FlowEdge, FlowGraph, FlowNode, XY } from "./flowMapping";
import { DETOUR_RATIO_DEGENERATE, clipRouteToEndpointRects, detourRatio } from "./edgeGeometry";
import { extractEdgeRoutingInput } from "./edgeRouting";
import type { EdgeRouteMap, EdgeRouter, EdgeRoutingInput, RoutedPoint } from "./edgeRouting";
import { isFolderGroupId } from "./graphIdentity";
import { NO_ORPHAN_TRUNCATION } from "./truncationBadges";
import type { OrphanTruncation } from "./truncationBadges";
import { LinkPreviewModels, edgeEndpointDisplayName } from "./linkPreviewModel";
import type {
	GraphLayoutPort,
	GraphSourcePort,
	LinkPreviewPort,
	NoteNavigatorPort,
	OpenNoteOptions,
} from "./viewPorts";

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

/**
 * `building` = the FIRST build of this controller's life is in flight, so there
 * is no answer yet. It exists because that build — and only that build — awaits
 * the docid warm-up, which reads file content and on a large vault takes seconds
 * (ticket nid_y081nezeucka9l0x3umebi5zo_e); `empty` would answer "there is no
 * graph for this file", which is a different, wrong statement.
 */
export type FlowStatus = "empty" | "building" | "ready";

export interface FlowSnapshot {
	readonly status: FlowStatus;
	readonly nodes: readonly FlowNode[];
	readonly edges: readonly FlowEdge[];
	/** Graph-corner "+N hidden" overlay data (zero-total constant when nothing is hidden). */
	readonly orphanTruncation: OrphanTruncation;
	/** The controls panel's read-model for this build (spec defaults when no graph). */
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
	mainPinned: false,
	globalDepths: EngineDefaults.depthSettings(),
	globalView: EngineDefaults.viewSettings(),
	nodeExclusion: EngineDefaults.nodeExclusionSettings(),
	excludedNodeCount: 0,
};

const EMPTY_SNAPSHOT: FlowSnapshot = {
	status: "empty",
	nodes: [],
	edges: [],
	orphanTruncation: NO_ORPHAN_TRUNCATION,
	controls: EMPTY_CONTROLS,
	layoutVersion: 0,
};

/** First build in flight: same void as {@link EMPTY_SNAPSHOT}, told honestly. */
const BUILDING_SNAPSHOT: FlowSnapshot = { ...EMPTY_SNAPSHOT, status: "building" };

/** Shared empty route map = every edge stays straight (routing off or failed). */
const EMPTY_ROUTES: EdgeRouteMap = new Map();

/** Dedup key for a routing failure that cannot be converted to a string at all. */
const UNSTRINGIFIABLE_FAILURE_SIGNATURE = "<unstringifiable routing failure>";

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
	/**
	 * True until a build has SETTLED — reached a terminal answer (a graph, empty,
	 * or a failure). Only that first build awaits the docid warm-up, a content
	 * scan that on a large vault takes seconds (ticket
	 * nid_y081nezeucka9l0x3umebi5zo_e), so it is the only build that can visibly
	 * wait and the only one allowed to publish {@link BUILDING_SNAPSHOT}. Every
	 * later rebuild reads a warm map and returns fast; a placeholder there would
	 * only flicker the pane — over a rendered graph AND over the empty state,
	 * which rebuilds on every metadata resolve (i.e. on every keystroke burst in
	 * a note with no vicinity graph).
	 */
	private firstBuildPending = true;
	/** Never reset — monotonicity lets the render layer diff it safely across empty gaps. */
	private layoutVersion = 0;
	/**
	 * Cached routed polylines keyed by a signature of the routing inputs
	 * (obstacles + edges + clearance). Reused when the signature is unchanged so a reuse-layout
	 * rebuild never re-runs libavoid; dropped on any input change or when routing is
	 * off (so a later edge-routing flip recomputes without forcing an elk relayout).
	 */
	private routeCache: { readonly signature: string; readonly routes: EdgeRouteMap } | null = null;
	/**
	 * Signatures of the pass-level routing failures already warned about. Deduping per
	 * signature rather than with a single latch keeps a rebuild loop from spamming the
	 * console while still surfacing a structurally DIFFERENT later failure (dead wasm
	 * module vs. contract violation vs. bad geometry) instead of swallowing it.
	 */
	private readonly warnedRoutingFailures = new Set<string>();

	constructor(
		private readonly navigator: NoteNavigatorPort,
		private readonly graphBuilder: GraphSourcePort,
		private readonly layoutRunner: GraphLayoutPort,
		private readonly edgeRouter: EdgeRouter,
		private readonly occurrences: LinkOccurrenceProvider,
		private readonly linkPreview: LinkPreviewPort,
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

	/**
	 * Click on an `a.internal-link` anchor inside a rendered snippet (the
	 * link-preview drawer): a LINKTEXT, not a node path, so it skips the
	 * folder-group guard and resolves via {@link NoteNavigatorPort.openMarkdownLink}.
	 */
	openMarkdownLink(linktext: string, sourcePath: string): void {
		this.navigator.openMarkdownLink(linktext, sourcePath);
	}

	/**
	 * Plain node click (ticket `nid_lfcyfbrggrusyv8xn1aroc7h1_e`): re-center the
	 * graph on the clicked node AND open its markdown in the current main-area
	 * tab (ticket `nid_r5xy3vuw2kj1v75soe4ffwdjz_e` — never a new tab, keeping
	 * the tab count down). MAIN is set BEFORE the open so the resulting
	 * active-file event is a no-op in {@link decideActiveFileRebuild} — one
	 * rebuild, not two. Folder-group ids are inert (no note behind them) and
	 * re-focusing the current MAIN is a no-op, mirroring that same decision.
	 */
	focusNode(path: string): void {
		if (isFolderGroupId(path) || path === this.mainPath) {
			return;
		}
		this.clearDebounce();
		this.mainPath = path;
		this.navigator.openNote(path, { newTab: false });
		void this.runRebuild();
	}

	/**
	 * Edge click: the EDGE-scoped preview, grouped per contributing note→note
	 * pair (ticket `nid_tiitgrp5bt7g2niwcvthxw1jk_e`). Looked up by rendered
	 * edge id because a group-collapsed edge's `source`/`target` are folder-group
	 * ids — the note pairs behind the visual live on {@link FlowEdge.notePairs}.
	 */
	async openEdgePreview(edgeId: string): Promise<void> {
		const edge = this.snapshot.edges.find((candidate) => candidate.id === edgeId);
		if (edge === undefined) {
			return; // The clicked edge left the graph before the click was handled.
		}
		const pairs = await Promise.all(
			edge.notePairs.map(async (pair) => {
				const sourcePath = asVaultPath(pair.source);
				const targetPath = asVaultPath(pair.target);
				return {
					sourcePath,
					targetPath,
					occurrences: await this.occurrences.occurrencesBetween(sourcePath, targetPath),
				};
			}),
		);
		this.linkPreview.showLinkPreview(
			LinkPreviewModels.edge({
				sourceName: edgeEndpointDisplayName(edge.source),
				targetName: edgeEndpointDisplayName(edge.target),
				bidirectional: edge.bidirectional,
				pairs,
			}),
		);
	}

	// --- pipeline ----------------------------------------------------------

	private async runRebuild(): Promise<void> {
		const token = ++this.rebuildToken;
		const mainPath = this.mainPath;
		if (mainPath === null) {
			// No MAIN to build: a definite (empty) answer, not a pending one — and no
			// build ran, so the next one is still the first paint.
			this.reset();
			return;
		}
		if (this.firstBuildPending) {
			this.setSnapshot(BUILDING_SNAPSHOT);
		}
		try {
			await this.buildAndPublish(token, mainPath);
		} catch (error: unknown) {
			// A rebuild that throws must not leave the placeholder standing: "Building…"
			// is a promise this pipeline can no longer keep, and nothing re-enters it
			// until the next vault/settings event. A RENDERED graph is kept — it is
			// still the last true answer we had — so only the placeholder gives way.
			console.error("vicinity-graph: rebuild failed", error);
			if (!this.isStale(token) && this.snapshot.status === "building") {
				this.reset();
			}
		} finally {
			// A superseded build settles nothing — its successor is still the first
			// paint, and the warm-up it awaits has not been paid for yet.
			if (!this.isStale(token)) {
				this.firstBuildPending = false;
			}
		}
	}

	/** One rebuild pass: engine build → structural diff → elk → routing → publish. */
	private async buildAndPublish(token: number, mainPath: string): Promise<void> {
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
		// The diff judges a committed resize against the geometry the reuse path would
		// keep (does the new box still fit where it is?), so it gets that geometry.
		const decision = decideLayout(this.previousGraph, graph, SIZE_RELAYOUT_THRESHOLD, {
			positions: this.positions,
			groupDimensions: this.groupDimensions,
		});
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
			const laidOut = await this.layoutRunner.layout(vicinityGraphToElk(graph), graph.viewSettings.forceLayout);
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
		const routes = await this.resolveRoutes(
			flow,
			positions,
			groupDimensions,
			graph.viewSettings.forceLayout.edgeRoutingClearancePx,
			token,
		);
		if (this.isStale(token)) {
			return;
		}
		this.publish(graph, positions, groupDimensions, withRoutedPoints(flow, routes));
	}

	/**
	 * Obstacle-avoiding routes for this build, or an empty map = straight edges.
	 * The routing pass always runs (libavoid wasm lazy-loads on first `route`).
	 * Caches by an input signature so a reuse-layout rebuild with unchanged
	 * obstacles/edges reuses the previous pass instead of re-running libavoid. A
	 * wasm-init/routing failure is contained here: warn once per distinct failure,
	 * return empty (single documented pass-level fallback — no per-edge silent
	 * fallbacks).
	 */
	private async resolveRoutes(
		flow: FlowGraph,
		positions: ReadonlyMap<string, XY>,
		groupDimensions: ReadonlyMap<string, Dimensions>,
		edgeRoutingClearancePx: number,
		token: number,
	): Promise<EdgeRouteMap> {
		const input = extractEdgeRoutingInput({
			nodes: flow.nodes,
			edges: flow.edges,
			positions,
			groupDimensions,
			shapeBufferPx: edgeRoutingClearancePx,
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
			const durationMs = performance.now() - routeStart;
			// Clip each route to its endpoint obstacle rects so arrows terminate ON the
			// box boundary (esp. a collapsed GROUP box), not at the centre pin libavoid
			// attaches connector endpoints to. Cache the CLIPPED routes so a reuse-layout
			// rebuild serves them straight from cache.
			const clippedRoutes = clipRoutesToObstacles(routes, input);
			// Detour telemetry on the CLIPPED routes (edge-routing__04): max/mean of the
			// per-edge detour ratio (routed length ÷ endpoint chord). Logged alongside the
			// duration so the boundary-pin change is verifiable numerically in the dev
			// vault, where the wasm router's route quality can't be unit-tested.
			//
			// Logged BEFORE the isStale early-return so the pass that ACTUALLY ran is what
			// gets measured: during rapid rebuilds the heavy dense pass is superseded
			// (stale) and would otherwise be discarded unlogged, letting the perf gate read
			// a trivial intermediate pass and false-pass (edge-routing__04). Clipping a
			// stale pass is a cheap, acceptable cost for correct telemetry.
			const detour = detourStats(clippedRoutes);
			console.debug("vicinity-graph: edge routing pass", {
				obstacleCount: input.obstacles.length,
				edgeCount: input.edges.length,
				durationMs,
				maxDetourRatio: detour.max,
				meanDetourRatio: detour.mean,
			});
			if (this.isStale(token)) {
				return EMPTY_ROUTES;
			}
			this.routeCache = { signature, routes: clippedRoutes };
			return clippedRoutes;
		} catch (error: unknown) {
			// WHY-NOT a typed failure channel on EdgeRouter.route(): this is its only consumer, and it
			// treats every cause identically — warn once, drop the cache, fall back to straight edges.
			// A discriminated result type would force all callers and both fakes to handle a union for
			// zero behavioural gain. (Owner decision 2026-07-29.) Revisit ONLY if we want to RETRY
			// wasm-init failures while still not retrying routing-contract violations — that is the one
			// thing typing would unlock; named error subclasses would be the smallest way to get it.
			this.warnRoutingFailureOncePerSignature(error);
			this.routeCache = null;
			return EMPTY_ROUTES;
		}
	}

	/** Report a routing failure unless one with the same signature was already reported. */
	private warnRoutingFailureOncePerSignature(error: unknown): void {
		const signature = GraphViewController.routingFailureSignature(error);
		if (this.warnedRoutingFailures.has(signature)) {
			return;
		}
		this.warnedRoutingFailures.add(signature);
		console.warn("vicinity-graph: edge routing failed; rendering straight edges", error);
	}

	/**
	 * Dedup key for a thrown routing failure. The `EdgeRouter` contract has no typed
	 * error channel, so anything can arrive here — `.name`/`.message` are never assumed,
	 * and even stringification is guarded so the failure REPORTER cannot itself throw
	 * (a null-prototype or hostile-`toString` throwable would otherwise fail the rebuild).
	 */
	private static routingFailureSignature(error: unknown): string {
		if (error instanceof Error) {
			return `${error.name}: ${error.message}`;
		}
		try {
			return String(error);
		} catch {
			return UNSTRINGIFIABLE_FAILURE_SIGNATURE;
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

/** Field separator for the route-cache signature — a NUL cannot occur in a vault path / id. */
const ROUTE_SIGNATURE_SEPARATOR = "\u0000";

/**
 * A stable string over EVERY routing input — obstacle geometry, edge endpoints AND
 * the clearance the pass will run at. Two builds with the same inputs produce the
 * same signature, so the route cache reuses the previous pass instead of re-running
 * libavoid. Insertion order is deterministic (flow node/edge order is stable for a
 * given graph).
 *
 * The clearance MUST be part of it: changing only the "Edge clearance" setting
 * leaves every obstacle where it was, so a geometry-only signature would serve the
 * stale routes back and the slider would look dead (covered by a controller test).
 */
function routingSignature(input: EdgeRoutingInput): string {
	const obstacles = input.obstacles.map(
		(o) => `${o.id}:${o.x},${o.y},${o.widthPx},${o.heightPx}`,
	);
	const edges = input.edges.map((e) => `${e.id}:${e.sourceId}->${e.targetId}`);
	return [
		String(input.shapeBufferPx),
		obstacles.join(ROUTE_SIGNATURE_SEPARATOR),
		edges.join(ROUTE_SIGNATURE_SEPARATOR),
	].join(ROUTE_SIGNATURE_SEPARATOR);
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

/** Max/mean of the per-route detour ratio over a pass (see {@link detourStats}). */
interface DetourStats {
	readonly max: number;
	readonly mean: number;
}

/** Neutral stats when a pass produced no routes — no detour to report, so 1 ("straight"). */
const EMPTY_DETOUR_STATS: DetourStats = { max: DETOUR_RATIO_DEGENERATE, mean: DETOUR_RATIO_DEGENERATE };

/**
 * Max and mean detour ratio over the CLIPPED routes of one pass, for the routing
 * debug log (edge-routing__04). Only edges that actually routed appear in the map,
 * so every entry contributes; an empty map yields the neutral {@link EMPTY_DETOUR_STATS}.
 */
function detourStats(routes: EdgeRouteMap): DetourStats {
	let max = 0;
	let sum = 0;
	let count = 0;
	for (const route of routes.values()) {
		const ratio = detourRatio(route);
		max = Math.max(max, ratio);
		sum += ratio;
		count += 1;
	}
	if (count === 0) {
		return EMPTY_DETOUR_STATS;
	}
	return { max, mean: sum / count };
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
