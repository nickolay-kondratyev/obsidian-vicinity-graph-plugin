import type { EdgeKind, GraphEdge, GraphNode, VicinityGraph, ViewSettings } from "../../engine";
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
		imagePrecedesOutline: false,
		sizePx: 100,
		...overrides,
	};
}

const DEFAULT_EDGE_LINK_COUNT = 1;

export function makeEdge(
	source: string,
	target: string,
	count = DEFAULT_EDGE_LINK_COUNT,
	kind: EdgeKind = "link",
	hierarchy = false,
): GraphEdge {
	return { source: asVaultPath(source), target: asVaultPath(target), count, kind, hierarchy };
}

/** Minimal effective view settings for view-layer tests (neutral, engine-decoupled). */
function makeViewSettings(): ViewSettings {
	return {
		nodeCap: 100,
		outlineMaxDepth: 2,
		nodePreviewPreference: "auto",
		showCrossLinks: false,
		sizing: {
			minPx: 40,
			maxPx: 160,
			minImageHeightPx: 120,
		},
		forceLayout: {
			centerPullStrength: 0.05,
			repelStrength: 300,
			linkStrengthFactor: 1,
			linkGapPx: 40,
			collidePaddingPx: 20,
			// Mirrors the shipped default so packing tests measure what users see.
			// The mirror is locked (see `groupPacking.test.ts`) — do not drift it.
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
