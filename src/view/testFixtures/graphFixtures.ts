import type { GraphEdge, GraphNode, VicinityGraph, ViewSettings } from "../../engine";
import { asFolderPath, asVaultPath } from "../../engine";

/**
 * Declarative fixture builders for view-layer tests. Plain-object factories with
 * `Partial` overrides — no engine run needed, no obsidian/React. Mirrors the
 * engine/adapter fixture style (BDD GIVEN lives in the override the test passes).
 */

export function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
	const path = overrides.path ?? asVaultPath("note.md");
	return {
		path,
		title: path.replace(/\.[^.]+$/, "").replace(/^.*\//, ""),
		folder: asFolderPath(""),
		sizeBytes: 100,
		isCentral: false,
		isMain: false,
		depthTags: [],
		minDepth: 1,
		attachments: [],
		sizeScore: 0.5,
		sizePx: 100,
		...overrides,
	};
}

const DEFAULT_EDGE_LINK_COUNT = 1;

export function makeEdge(source: string, target: string, count = DEFAULT_EDGE_LINK_COUNT): GraphEdge {
	return { source: asVaultPath(source), target: asVaultPath(target), count };
}

/**
 * Minimal effective view settings — deliberately DECOUPLED from the engine
 * production defaults so unit tests stay neutral and opt in to behavior per case:
 * - `edgeRouting: false` (NOT the engine's now-`true` default, flipped in
 *   edge-routing__03) keeps the routing pass OFF for pure mapping/controller
 *   baselines (no wasm invoked); routing tests opt in via {@link withEdgeRouting}.
 *   Mirroring the engine default here would make every mapping test implicitly
 *   run the router and break the controller "routing OFF" baseline.
 */
function makeViewSettings(): ViewSettings {
	return {
		nodeCap: 100,
		groupByFolder: true,
		edgeVisibility: "walked-from-center",
		edgeRouting: false,
		sizing: {
			metrics: {
				"own-file-size": { enabled: true, weight: 1 },
				"total-linker-size": { enabled: false, weight: 1 },
				"backlink-count": { enabled: false, weight: 1 },
				"outlink-count": { enabled: false, weight: 1 },
				"depth-decay": { enabled: false, weight: 1 },
			},
			depthDecayK: 1,
			minPx: 40,
			maxPx: 160,
		},
	};
}

export function makeGraph(overrides: Partial<VicinityGraph> = {}): VicinityGraph {
	return {
		nodes: [],
		edges: [],
		hiddenNodeCountsByFolder: new Map(),
		excludedNodeCount: 0,
		viewSettings: makeViewSettings(),
		...overrides,
	};
}

/** The same graph with the obstacle-avoiding edge-routing pass toggled (fixture baseline OFF). */
export function withEdgeRouting(graph: VicinityGraph, edgeRouting: boolean): VicinityGraph {
	return { ...graph, viewSettings: { ...graph.viewSettings, edgeRouting } };
}
