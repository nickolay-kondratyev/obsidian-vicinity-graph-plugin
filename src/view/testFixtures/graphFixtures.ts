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
		outline: [],
		sizeScore: 0.5,
		sizePx: 100,
		...overrides,
	};
}

const DEFAULT_EDGE_LINK_COUNT = 1;

export function makeEdge(source: string, target: string, count = DEFAULT_EDGE_LINK_COUNT): GraphEdge {
	return { source: asVaultPath(source), target: asVaultPath(target), count };
}

/** Minimal effective view settings for view-layer tests (neutral, engine-decoupled). */
function makeViewSettings(): ViewSettings {
	return {
		nodeCap: 100,
		outlineMaxDepth: 2,
		groupByFolder: true,
		edgeVisibility: "walked-from-center",
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
		forceLayout: {
			centerPullStrength: 0.05,
			repelStrength: 300,
			linkStrengthFactor: 1,
			linkGapPx: 40,
			collidePaddingPx: 20,
			elkNodeSpacingPx: 40,
			edgeRoutingClearancePx: 11,
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
