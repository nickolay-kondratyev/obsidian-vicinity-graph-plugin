/**
 * Root-seed-spacing sweep harness (ticket nid_zvoay26y4y9h1e2p2b1y9glfk_e).
 *
 * NOT source-controlled under src/ on purpose: it is a one-off measurement rig,
 * not a behavior test. To reproduce, copy this file and `vitest.config.ts` into
 * `.tmp/seed-sweep/` at the repo root and run
 *
 *   npx vitest run --config .tmp/seed-sweep/vitest.config.ts
 *   SWEEP_SEEDS=36,37,38,39,40,41,42,43,44 SWEEP_OUT=.tmp/seed-sweep/results-fine.tsv \
 *     npx vitest run --config .tmp/seed-sweep/vitest.config.ts
 *
 * It runs the PRODUCTION pipeline (`vicinityGraphToElk` -> `GraphLayoutRunner`,
 * i.e. elk force seed + d3 refinement) with ONE option swapped on the root:
 * `elk.spacing.nodeNode`. That is exactly what `ELK_ROOT_SEED_NODE_SPACING_PX`
 * emits, so the seed can be swept in ISOLATION — group interiors stay at the
 * shipped 20px — with no source edit.
 */
import { describe, it } from "vitest";
import { asFolderPath, asVaultPath } from "../../src/engine";
import type { GraphEdge, GraphNode, VicinityGraph } from "../../src/engine";
import { GraphLayoutRunner } from "../../src/view/GraphLayoutRunner";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "../../src/view/elkMapping";
import { rectExtentAlong } from "../../src/view/forceRectLink";
import { makeEdge, makeGraph, makeNode } from "../../src/view/testFixtures/graphFixtures";
import type { ElkNode } from "elkjs";

const SEEDS = (process.env.SWEEP_SEEDS ?? "5,10,15,20,25,30,35,40,45,50,60,70,80,100,120,160,200")
	.split(",")
	.map(Number);
const OUT = process.env.SWEEP_OUT ?? ".tmp/seed-sweep/results.tsv";

// ---------------------------------------------------------------- fixtures

const WIDE_TITLE = "a deliberately long note title that saturates the label width cap";

/** d3ForceStranding portrait mirror: folder-grouped hub + crowd + degree-1 leaf. */
function strandedHub(members: { sizePx: number; title: string }): VicinityGraph {
	const CROWD = 5;
	const crowd = Array.from({ length: CROWD }, (_, i) =>
		makeNode({ path: asVaultPath(`crowd${i}.md`), minDepth: 1, sizePx: 80 }),
	);
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("main.md"), isCentral: true, isMain: true, minDepth: 0, sizePx: 100 }),
			makeNode({
				path: asVaultPath("p/ep/hub.md"),
				title: members.title,
				folder: asFolderPath("p/ep"),
				minDepth: 1,
				sizePx: members.sizePx,
			}),
			makeNode({
				path: asVaultPath("p/ep/sib.md"),
				title: members.title,
				folder: asFolderPath("p/ep"),
				minDepth: 1,
				sizePx: members.sizePx,
			}),
			...crowd,
			makeNode({
				path: asVaultPath("p/ep/book/enchiridion.md"),
				folder: asFolderPath("p/ep/book"),
				minDepth: 2,
				sizePx: 80,
			}),
		],
		edges: [
			makeEdge("main.md", "p/ep/hub.md"),
			makeEdge("p/ep/hub.md", "p/ep/sib.md"),
			...crowd.map((n) => makeEdge("p/ep/hub.md", n.path)),
			makeEdge("p/ep/hub.md", "p/ep/book/enchiridion.md"),
		],
	});
}

/** Multi-folder vault mirror: `folders` groups of `perFolder` members + loose leaves. */
function multiFolderVault(folders: number, perFolder: number, looseLeaves: number): VicinityGraph {
	const nodes: GraphNode[] = [
		makeNode({ path: asVaultPath("main.md"), isCentral: true, isMain: true, minDepth: 0, sizePx: 120 }),
	];
	const edges: GraphEdge[] = [];
	for (let f = 0; f < folders; f++) {
		const folder = asFolderPath(`f${f}`);
		for (let m = 0; m < perFolder; m++) {
			const path = `f${f}/m${m}.md`;
			nodes.push(
				makeNode({
					path: asVaultPath(path),
					folder,
					minDepth: 1,
					// Heterogeneous like NodeSizer output.
					sizePx: 60 + ((f * 7 + m * 37) % 100),
					title: (f + m) % 3 === 0 ? WIDE_TITLE : `n${f}_${m}`,
				}),
			);
			if (m === 0) {
				edges.push(makeEdge("main.md", path));
			} else {
				edges.push(makeEdge(`f${f}/m0.md`, path));
			}
		}
	}
	for (let l = 0; l < looseLeaves; l++) {
		const path = `loose${l}.md`;
		nodes.push(makeNode({ path: asVaultPath(path), minDepth: 1, sizePx: 60 + ((l * 53) % 100) }));
		edges.push(makeEdge(l % 2 === 0 ? "main.md" : "f0/m0.md", path));
	}
	return makeGraph({ nodes, edges });
}

/** Star of ungrouped leaves around the central note (no containers at all). */
function ungroupedStar(leaves: number): VicinityGraph {
	const nodes = [makeNode({ path: asVaultPath("main.md"), isCentral: true, isMain: true, sizePx: 140 })];
	const edges: GraphEdge[] = [];
	for (let i = 0; i < leaves; i++) {
		const path = `leaf${i}.md`;
		nodes.push(makeNode({ path: asVaultPath(path), sizePx: 60 + ((i * 41) % 100) }));
		edges.push(makeEdge("main.md", path));
	}
	return makeGraph({ nodes, edges });
}

/** A chain of grouped clusters — long, thin root topology. */
function clusterChain(clusters: number): VicinityGraph {
	const nodes: GraphNode[] = [];
	const edges: GraphEdge[] = [];
	for (let c = 0; c < clusters; c++) {
		const folder = asFolderPath(`c${c}`);
		for (let m = 0; m < 3; m++) {
			nodes.push(
				makeNode({
					path: asVaultPath(`c${c}/m${m}.md`),
					folder,
					sizePx: 80 + ((c * 23 + m * 31) % 80),
					isCentral: c === 0 && m === 0,
					isMain: c === 0 && m === 0,
				}),
			);
		}
		edges.push(makeEdge(`c${c}/m0.md`, `c${c}/m1.md`), makeEdge(`c${c}/m0.md`, `c${c}/m2.md`));
		if (c > 0) {
			edges.push(makeEdge(`c${c - 1}/m0.md`, `c${c}/m0.md`));
		}
	}
	return makeGraph({ nodes, edges });
}

const FIXTURES: readonly { name: string; graph: VicinityGraph }[] = [
	{ name: "stranding-portrait", graph: strandedHub({ sizePx: 160, title: "note" }) },
	{ name: "stranding-landscape", graph: strandedHub({ sizePx: 40, title: WIDE_TITLE }) },
	{ name: "vault-3folders-4each-3loose", graph: multiFolderVault(3, 4, 3) },
	{ name: "vault-6folders-5each-8loose", graph: multiFolderVault(6, 5, 8) },
	{ name: "vault-10folders-3each-15loose", graph: multiFolderVault(10, 3, 15) },
	{ name: "ungrouped-star-12", graph: ungroupedStar(12) },
	{ name: "ungrouped-star-30", graph: ungroupedStar(30) },
	{ name: "cluster-chain-6", graph: clusterChain(6) },
	{ name: "cluster-chain-12", graph: clusterChain(12) },
];

// ---------------------------------------------------------------- metrics

interface Metrics {
	readonly worstGap: number;
	readonly meanGap: number;
	readonly strandedEdges: number;
	readonly bboxArea: number;
	readonly fill: number;
	readonly overlaps: number;
	readonly rootBoxes: number;
}

/** Same budget the shipped stranding suite asserts. */
const BOUNDARY_GAP_BUDGET_PX = 100;

async function measure(graph: VicinityGraph, seedPx: number): Promise<Metrics> {
	const mapped = vicinityGraphToElk(graph);
	const seeded: ElkNode = {
		...mapped,
		layoutOptions: { ...mapped.layoutOptions, "elk.spacing.nodeNode": String(seedPx) },
	};
	const laidOut = await new GraphLayoutRunner().layout(seeded);
	const positions = extractElkPositions(laidOut);
	const dims = extractElkDimensionsById(laidOut);
	const rootIds = (laidOut.children ?? []).map((c) => c.id);
	const boxes = rootIds.map((id) => {
		const p = positions.get(id);
		const d = dims.get(id);
		if (p === undefined || d === undefined) {
			throw new Error(`missing layout for ${id}`);
		}
		return { id, ...p, ...d };
	});
	const centreOf = (id: string) => {
		const b = boxes.find((box) => box.id === id);
		if (b === undefined) {
			throw new Error(`not a root box: ${id}`);
		}
		return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
	};
	// Same projected-extent gap the shipped stranding suite measures.
	const gaps = (seeded.edges ?? []).map((edge) => {
		const s = centreOf(edge.sources[0] as string);
		const t = centreOf(edge.targets[0] as string);
		const dx = t.x - s.x;
		const dy = t.y - s.y;
		const dist = Math.hypot(dx, dy);
		if (dist === 0) {
			return 0;
		}
		return (
			dist -
			rectExtentAlong({ halfWidth: s.w / 2, halfHeight: s.h / 2 }, dx, dy) -
			rectExtentAlong({ halfWidth: t.w / 2, halfHeight: t.h / 2 }, dx, dy)
		);
	});
	const minX = Math.min(...boxes.map((b) => b.x));
	const minY = Math.min(...boxes.map((b) => b.y));
	const maxX = Math.max(...boxes.map((b) => b.x + b.width));
	const maxY = Math.max(...boxes.map((b) => b.y + b.height));
	const bboxArea = (maxX - minX) * (maxY - minY);
	const boxArea = boxes.reduce((sum, b) => sum + b.width * b.height, 0);
	let overlaps = 0;
	for (let i = 0; i < boxes.length; i++) {
		for (let j = i + 1; j < boxes.length; j++) {
			const a = boxes[i] as (typeof boxes)[number];
			const b = boxes[j] as (typeof boxes)[number];
			const OVERLAP_EPSILON_PX = 0.5;
			if (
				a.x < b.x + b.width - OVERLAP_EPSILON_PX &&
				b.x < a.x + a.width - OVERLAP_EPSILON_PX &&
				a.y < b.y + b.height - OVERLAP_EPSILON_PX &&
				b.y < a.y + a.height - OVERLAP_EPSILON_PX
			) {
				overlaps++;
			}
		}
	}
	return {
		worstGap: gaps.length === 0 ? 0 : Math.max(...gaps),
		meanGap: gaps.length === 0 ? 0 : gaps.reduce((s, g) => s + g, 0) / gaps.length,
		strandedEdges: gaps.filter((g) => g > BOUNDARY_GAP_BUDGET_PX).length,
		bboxArea,
		fill: boxArea / bboxArea,
		overlaps,
		rootBoxes: boxes.length,
	};
}

describe("root seed spacing sweep", () => {
	it("sweeps", async () => {
		const rows: string[] = [];
		rows.push(
			["fixture", "seed", "worstGap", "meanGap", "stranded", "bboxArea", "fill", "overlaps", "rootBoxes"].join("\t"),
		);
		for (const fixture of FIXTURES) {
			for (const seed of SEEDS) {
				const m = await measure(fixture.graph, seed);
				rows.push(
					[
						fixture.name,
						seed,
						m.worstGap.toFixed(1),
						m.meanGap.toFixed(1),
						m.strandedEdges,
						Math.round(m.bboxArea),
						m.fill.toFixed(3),
						m.overlaps,
						m.rootBoxes,
					].join("\t"),
				);
			}
		}
		const { writeFileSync } = await import("node:fs");
		writeFileSync(OUT, rows.join("\n") + "\n");
	});
});
