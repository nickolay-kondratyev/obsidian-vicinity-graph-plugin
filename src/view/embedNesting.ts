import type { GraphEdge, GraphNode, VaultPath, VicinityGraph } from "../engine";

/**
 * Embed-nesting forest derivation (embed-nesting P2): pure, deterministic,
 * RF-free — a sibling of {@link import("./folderGrouping").deriveFolderGroups}.
 *
 * Given the rendered {@link VicinityGraph} (POST-truncation — decision Q7), it
 * assigns each rendered node an optional CONTAINER (a rendered node that embeds
 * it), forming a NESTING FOREST. See `docs-internal/vocab.md` for the terms
 * (nested node / container / outermost container).
 *
 * ## Candidacy
 * A node `s` may contain `n` iff there is a directed edge `s → n` of kind
 * `embed`/`both` (a {@link GraphEdge} is source→target, so `s` embeds `n`).
 *
 * ## Precedence + constraints (decisions Q1/Q2)
 * MAIN (`isMain`) beats PINNED (`isCentral && !isMain`) beats REGULAR; ties break
 * by smaller `minDepth`, then lexicographic path. The MAIN node is NEVER nested;
 * a pinned node nests only under main or another pin; a regular node nests under
 * any embedder.
 *
 * ## Cycles (decision Q3, made precise 2026-08-06)
 * Candidate edges inside a directed CYCLE of the rendered embed graph are
 * excluded from candidacy UP FRONT: we compute strongly-connected components over
 * the `embed`/`both` edges and drop every candidate edge whose endpoints share an
 * SCC of size > 1 (self-embeds too). A mutual embed therefore nests in NEITHER
 * direction — both notes render standalone with the plain edge intact — while a
 * cycle member can still nest under an embedder OUTSIDE its SCC. Once the surviving
 * candidate set is acyclic, each node independently picking its single best
 * candidate can never form a cycle, so the forest property is free — no
 * incremental cycle check needed.
 */

/** One rendered node's place in the nesting forest. */
export interface NodeNesting {
	readonly path: VaultPath;
	/** The direct embedder this node nests inside, or absent when it renders standalone / as a root. */
	readonly containerPath?: VaultPath;
	/** Root of this node's nesting tree — the node itself when it is a root. */
	readonly outermostPath: VaultPath;
	/** Nested children, ordered by embedOrder then path. */
	readonly childPaths: readonly VaultPath[];
}

export interface NestingForest {
	/** Every rendered node's assignment, keyed by vault path. */
	readonly nestingByPath: ReadonlyMap<string, NodeNesting>;
}

/** Container precedence rank — lower wins (decision Q1: central == isMain). */
const RANK_MAIN = 0;
const RANK_PINNED = 1;
const RANK_REGULAR = 2;

function isPinned(node: GraphNode): boolean {
	return node.isCentral && !node.isMain;
}

function containerRank(node: GraphNode): number {
	if (node.isMain) {
		return RANK_MAIN;
	}
	return isPinned(node) ? RANK_PINNED : RANK_REGULAR;
}

function comparePath(a: string, b: string): number {
	if (a < b) {
		return -1;
	}
	return a > b ? 1 : 0;
}

/** A plain-link edge has no embed occurrence to order — sort it last, deterministically. */
function embedOrderKey(edge: GraphEdge): number {
	return edge.embedOrder ?? Number.MAX_SAFE_INTEGER;
}

/**
 * CONTRACT: a pure, deterministic function of the graph (like
 * {@link import("./folderGrouping").deriveFolderGroups}). No obsidian/react
 * imports — flowMapping consumes this downstream and must stay pure too.
 */
export function deriveNestingForest(graph: VicinityGraph): NestingForest {
	const nodesByPath = new Map<string, GraphNode>();
	for (const node of graph.nodes) {
		nodesByPath.set(node.path, node);
	}

	// Embed candidacy edges: kind embed|both, both endpoints rendered.
	const embedEdges = graph.edges.filter(
		(edge) =>
			(edge.kind === "embed" || edge.kind === "both") &&
			nodesByPath.has(edge.source) &&
			nodesByPath.has(edge.target),
	);

	const sccIdByPath = computeSccIds(graph.nodes, embedEdges);
	const sccSizeById = new Map<number, number>();
	for (const id of sccIdByPath.values()) {
		sccSizeById.set(id, (sccSizeById.get(id) ?? 0) + 1);
	}

	// Drop self-embeds and any edge whose endpoints share a non-trivial SCC (a cycle).
	const candidateEdges = embedEdges.filter((edge) => {
		if (edge.source === edge.target) {
			return false;
		}
		const sourceScc = sccIdByPath.get(edge.source);
		const sharesCycle = sourceScc !== undefined &&
			sourceScc === sccIdByPath.get(edge.target) &&
			(sccSizeById.get(sourceScc) ?? 0) > 1;
		return !sharesCycle;
	});

	const containerEdgeByChild = chooseContainers(graph.nodes, candidateEdges, nodesByPath);
	return { nestingByPath: assembleForest(graph.nodes, containerEdgeByChild) };
}

/**
 * Per child, pick the single best surviving candidate edge — honoring the
 * never-nested constraints (main never nests; a pin nests only under main/pin)
 * and the precedence/tie-break order.
 */
function chooseContainers(
	nodes: readonly GraphNode[],
	candidateEdges: readonly GraphEdge[],
	nodesByPath: ReadonlyMap<string, GraphNode>,
): Map<string, GraphEdge> {
	const candidatesByChild = new Map<string, GraphEdge[]>();
	for (const edge of candidateEdges) {
		const bucket = candidatesByChild.get(edge.target) ?? [];
		bucket.push(edge);
		candidatesByChild.set(edge.target, bucket);
	}

	const containerEdgeByChild = new Map<string, GraphEdge>();
	for (const child of nodes) {
		if (child.isMain) {
			continue; // the main node is never nested
		}
		const candidates = candidatesByChild.get(child.path);
		if (candidates === undefined) {
			continue;
		}
		const eligible = candidates.filter((edge) => {
			if (!isPinned(child)) {
				return true; // a regular node nests under any embedder
			}
			const container = nodesByPath.get(edge.source);
			return container !== undefined && (container.isMain || isPinned(container));
		});
		const best = pickBestContainerEdge(eligible, nodesByPath);
		if (best !== undefined) {
			containerEdgeByChild.set(child.path, best);
		}
	}
	return containerEdgeByChild;
}

/** Lowest rank, then smallest minDepth, then lexicographic source path. */
function pickBestContainerEdge(
	edges: readonly GraphEdge[],
	nodesByPath: ReadonlyMap<string, GraphNode>,
): GraphEdge | undefined {
	let best: GraphEdge | undefined;
	let bestContainer: GraphNode | undefined;
	for (const edge of edges) {
		const container = nodesByPath.get(edge.source);
		if (container === undefined) {
			continue;
		}
		if (best === undefined || bestContainer === undefined || isBetterContainer(container, edge, bestContainer, best)) {
			best = edge;
			bestContainer = container;
		}
	}
	return best;
}

function isBetterContainer(
	container: GraphNode,
	edge: GraphEdge,
	incumbent: GraphNode,
	incumbentEdge: GraphEdge,
): boolean {
	return (
		containerRank(container) - containerRank(incumbent) ||
		container.minDepth - incumbent.minDepth ||
		comparePath(edge.source, incumbentEdge.source)
	) < 0;
}

/**
 * Turn the child→container-edge map into a per-node forest: resolve the outermost
 * container (walk container pointers — acyclic by construction) and each node's
 * children ordered by embedOrder then path.
 */
function assembleForest(
	nodes: readonly GraphNode[],
	containerEdgeByChild: ReadonlyMap<string, GraphEdge>,
): Map<string, NodeNesting> {
	const childEdgesByContainer = new Map<string, GraphEdge[]>();
	for (const edge of containerEdgeByChild.values()) {
		const bucket = childEdgesByContainer.get(edge.source) ?? [];
		bucket.push(edge);
		childEdgesByContainer.set(edge.source, bucket);
	}

	const outermostOf = (path: string): VaultPath => {
		let current = path;
		let containerEdge = containerEdgeByChild.get(current);
		while (containerEdge !== undefined) {
			current = containerEdge.source;
			containerEdge = containerEdgeByChild.get(current);
		}
		return current as VaultPath;
	};

	const nestingByPath = new Map<string, NodeNesting>();
	for (const node of nodes) {
		const containerEdge = containerEdgeByChild.get(node.path);
		const childEdges = [...(childEdgesByContainer.get(node.path) ?? [])].sort(
			(a, b) => embedOrderKey(a) - embedOrderKey(b) || comparePath(a.target, b.target),
		);
		nestingByPath.set(node.path, {
			path: node.path,
			containerPath: containerEdge?.source,
			outermostPath: outermostOf(node.path),
			childPaths: childEdges.map((edge) => edge.target),
		});
	}
	return nestingByPath;
}

/**
 * Tarjan's strongly-connected components over the rendered `embed`/`both` graph.
 * Returns each node's SCC id; a shared id with SCC size > 1 means the pair lies on
 * a directed embed cycle. Deterministic in node/edge order (recursion depth is
 * bounded by the rendered node count, itself capped by the node cap).
 */
function computeSccIds(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): Map<string, number> {
	const adjacency = new Map<string, string[]>();
	for (const node of nodes) {
		adjacency.set(node.path, []);
	}
	for (const edge of edges) {
		adjacency.get(edge.source)?.push(edge.target);
	}

	const indexByNode = new Map<string, number>();
	const lowlink = new Map<string, number>();
	const onStack = new Set<string>();
	const stack: string[] = [];
	const sccIdByPath = new Map<string, number>();
	let nextIndex = 0;
	let nextSccId = 0;

	const strongConnect = (v: string): void => {
		indexByNode.set(v, nextIndex);
		lowlink.set(v, nextIndex);
		nextIndex++;
		stack.push(v);
		onStack.add(v);
		for (const w of adjacency.get(v) ?? []) {
			if (!indexByNode.has(w)) {
				strongConnect(w);
				lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(w) ?? 0));
			} else if (onStack.has(w)) {
				lowlink.set(v, Math.min(lowlink.get(v) ?? 0, indexByNode.get(w) ?? 0));
			}
		}
		if (lowlink.get(v) === indexByNode.get(v)) {
			let popped: string;
			do {
				popped = stack.pop() as string;
				onStack.delete(popped);
				sccIdByPath.set(popped, nextSccId);
			} while (popped !== v);
			nextSccId++;
		}
	};

	for (const node of nodes) {
		if (!indexByNode.has(node.path)) {
			strongConnect(node.path);
		}
	}
	return sccIdByPath;
}
