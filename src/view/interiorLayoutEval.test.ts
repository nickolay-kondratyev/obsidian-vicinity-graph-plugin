import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { ElkNode } from "elkjs";
import { asFolderPath, asVaultPath } from "../engine";
import type { GraphEdge, GraphNode, VicinityGraph } from "../engine";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { GraphLayoutRunner } from "./GraphLayoutRunner";
import { ELK_FORCE_ALGORITHM, GROUP_SIDE_PADDING_PX, elkGroupMemberForceOptions } from "./constants";
import { refitContainerBox } from "./containerBoxRefit";
import { refineForceRootLayout } from "./d3ForceRefinement";
import { extractElkDimensionsById, extractElkPositions, vicinityGraphToElk } from "./elkMapping";
import { withContainerOptions } from "./testFixtures/elkContainerAlgorithm";
import { makeEdge, makeGraph, makeNode } from "./testFixtures/graphFixtures";

/**
 * Reproducible evaluation harness for the edge-aware interior-layout question
 * (ticket nid_7abfje1vus15rx9hzmpel9jin_e). Mirrors the rectpacking density
 * sweep in `groupPacking.test.ts`, but adds INTRA-GROUP EDGES and NESTED
 * containers and measures the candidates — rectpacking (baseline), the
 * PRODUCTION force configuration (`elkGroupMemberForceOptions`: capped force
 * seed + per-container d3 refinement + box refit), the rect-seeded d3 variant,
 * and elk stress — on density, edge length, edge crossings and layout time.
 * The measured record it writes to `.out/interior-eval.md` is the evidence
 * behind the interior-layout comments in `constants.ts` and the owner's
 * reserved visual sign-off; the TUNING sweeps behind the chosen seed-iteration
 * cap are recorded in the ticket.
 *
 * GATED OFF by default (heavy: 120 layouts, ~4s, and it writes to `.out/`), so
 * `npm test` skips it. Re-run the record with:
 *   VICINITY_INTERIOR_EVAL=1 npx vitest run src/view/interiorLayoutEval.test.ts
 *
 * The FORCE candidate runs entirely on the real path: `GraphLayoutRunner`
 * refines each force container's interior AND refits its box
 * (`containerBoxRefit.ts`), so its numbers are the shippable pipeline's own.
 * The density metric below still computes each group's box from its members'
 * bounding box rather than reading the container dims, ON PURPOSE: stress is
 * not the d3-refined candidate, so it gets no refit and its stored box is
 * stale — the members-bbox definition measures every candidate on equal
 * footing (for rectpacking and force it matches the real box up to the fixed
 * label padding).
 */
const RUN_EVAL = process.env.VICINITY_INTERIOR_EVAL === "1";

type Candidate = "rectpacking" | "force" | "force-rectseed" | "stress";

/** The candidate's elk tree: folder-group interiors rewritten to its options. */
function candidateElk(graph: VicinityGraph, candidate: Candidate): ElkNode {
	const mapped = vicinityGraphToElk(graph);
	if (candidate === "rectpacking" || candidate === "force-rectseed") {
		return mapped; // as mapped (rectpacking + orderBySize + spacing)
	}
	if (candidate === "force") {
		// The PRODUCTION edge-aware configuration (capped force seed + d3 + refit).
		return withContainerOptions(mapped, elkGroupMemberForceOptions(graph.viewSettings.forceLayout.elkNodeSpacingPx));
	}
	return withContainerOptions(mapped, { "elk.algorithm": "stress", "elk.stress.desiredEdgeLength": "120" });
}

interface Rect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

interface Metrics {
	readonly groupBoxAreaPx: number; // summed container bbox area
	readonly groupCount: number;
	readonly fillRatio: number; // member area / bbox area, mean over groups
	readonly edgeLenPx: number; // mean intra-group edge length
	readonly edgeCount: number;
	readonly crossings: number; // total intra-group crossings
	readonly timeMs: number;
}

function centerOf(r: Rect): { x: number; y: number } {
	return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

function segmentsCross(a1: { x: number; y: number }, a2: { x: number; y: number }, b1: { x: number; y: number }, b2: { x: number; y: number }): boolean {
	const d = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
		(q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
	const d1 = d(b1, b2, a1);
	const d2 = d(b1, b2, a2);
	const d3 = d(a1, a2, b1);
	const d4 = d(a1, a2, b2);
	return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

type ForceLayoutOf = VicinityGraph["viewSettings"]["forceLayout"];

/**
 * Measurement scaffold for the `force-rectseed` alternative, which the runner
 * deliberately does NOT express (rect-packed elk interiors, then the d3
 * refinement + box refit): replicates the runner's private bottom-up walk.
 * Kept in the record because it is the densest edge-aware variant (see the
 * ticket) — if the owner's visual pick ever wants it, this is its spec.
 */
function rectseedRefineWalk(node: ElkNode, settings: ForceLayoutOf, isRoot: boolean): ElkNode {
	const children = node.children;
	if (children === undefined) return node;
	const withRefined: ElkNode = {
		...node,
		children: children.map((c) => rectseedRefineWalk(c, settings, false)),
	};
	if (node.layoutOptions?.["elk.algorithm"] !== ELK_FORCE_ALGORITHM) return withRefined;
	const refined = refineForceRootLayout(withRefined, settings);
	return isRoot ? refined : refitContainerBox(refined);
}

async function measure(graph: VicinityGraph, candidate: Candidate): Promise<Metrics> {
	const runner = new GraphLayoutRunner();
	const elk = candidateElk(graph, candidate);
	const settings = graph.viewSettings.forceLayout;
	const started = performance.now();
	const laidOut =
		candidate === "force-rectseed"
			? rectseedRefineWalk(
					withContainerOptions(await new ElkLayoutRunner().layout(elk), { "elk.algorithm": ELK_FORCE_ALGORITHM }),
					settings,
					true,
				)
			: await runner.layout(elk, settings);
	const timeMs = performance.now() - started;
	const positions = extractElkPositions(laidOut);
	const dims = extractElkDimensionsById(laidOut);

	// Absolute rect for every member note.
	const memberFolders = new Set(graph.nodes.filter((n) => n.folder !== asFolderPath("")).map((n) => n.folder));
	const rectOf = (id: string): Rect | undefined => {
		const p = positions.get(id);
		const d = dims.get(id);
		if (p === undefined || d === undefined) return undefined;
		return { x: p.x, y: p.y, width: d.width, height: d.height };
	};

	// Per group: bbox of its DIRECT note members (absolute), member area, box area.
	let groupBoxAreaPx = 0;
	let fillSum = 0;
	let groupCount = 0;
	for (const folder of memberFolders) {
		const members = graph.nodes.filter((n) => n.folder === folder);
		const rects = members.map((n) => rectOf(n.path)).filter((r): r is Rect => r !== undefined);
		if (rects.length === 0) continue;
		const minX = Math.min(...rects.map((r) => r.x));
		const minY = Math.min(...rects.map((r) => r.y));
		const maxX = Math.max(...rects.map((r) => r.x + r.width));
		const maxY = Math.max(...rects.map((r) => r.y + r.height));
		const bboxW = maxX - minX + 2 * GROUP_SIDE_PADDING_PX;
		const bboxH = maxY - minY + 2 * GROUP_SIDE_PADDING_PX;
		const boxArea = bboxW * bboxH;
		const memberArea = rects.reduce((s, r) => s + r.width * r.height, 0);
		groupBoxAreaPx += boxArea;
		fillSum += memberArea / boxArea;
		groupCount += 1;
	}

	// Intra-group edges: both endpoints direct members of the SAME folder.
	const folderOf = new Map(graph.nodes.map((n) => [n.path, n.folder]));
	const intra = graph.edges.filter(
		(e) => folderOf.get(e.source) === folderOf.get(e.target) && folderOf.get(e.source) !== asFolderPath("") && folderOf.get(e.source) !== undefined,
	);
	let edgeLenSum = 0;
	let edgeCount = 0;
	const segsByFolder = new Map<string, { a: { x: number; y: number }; b: { x: number; y: number } }[]>();
	for (const e of intra) {
		const rs = rectOf(e.source);
		const rt = rectOf(e.target);
		if (rs === undefined || rt === undefined) continue;
		const a = centerOf(rs);
		const b = centerOf(rt);
		edgeLenSum += Math.hypot(a.x - b.x, a.y - b.y);
		edgeCount += 1;
		const key = folderOf.get(e.source) as string;
		const list = segsByFolder.get(key) ?? [];
		list.push({ a, b });
		segsByFolder.set(key, list);
	}
	let crossings = 0;
	for (const segs of segsByFolder.values()) {
		for (let i = 0; i < segs.length; i++) {
			for (let j = i + 1; j < segs.length; j++) {
				const si = segs[i];
				const sj = segs[j];
				if (si === undefined || sj === undefined) continue;
				if (segmentsCross(si.a, si.b, sj.a, sj.b)) crossings += 1;
			}
		}
	}

	return {
		groupBoxAreaPx,
		groupCount,
		fillRatio: groupCount === 0 ? 0 : fillSum / groupCount,
		edgeLenPx: edgeCount === 0 ? 0 : edgeLenSum / edgeCount,
		edgeCount,
		crossings,
		timeMs,
	};
}

// ---- Fixture sweep ------------------------------------------------------

type LinkShape = "none" | "hub" | "chain" | "dense";

function memberNode(folder: string, tag: string, index: number): GraphNode {
	const MIN = 60;
	const SPREAD = 100;
	return makeNode({
		path: asVaultPath(`${folder}/${tag}${index}.md`),
		folder: asFolderPath(folder),
		sizePx: MIN + ((index * 37) % SPREAD),
	});
}

function shapeEdges(folder: string, tag: string, count: number, shape: LinkShape): GraphEdge[] {
	const p = (i: number) => `${folder}/${tag}${i}.md`;
	if (shape === "none") return [];
	if (shape === "hub") return Array.from({ length: count - 1 }, (_, i) => makeEdge(p(0), p(i + 1)));
	if (shape === "chain") return Array.from({ length: count - 1 }, (_, i) => makeEdge(p(i), p(i + 1)));
	// dense: chain + a few skip links → deliberately crossing-prone.
	const chain = Array.from({ length: count - 1 }, (_, i) => makeEdge(p(i), p(i + 1)));
	const skips = Array.from({ length: Math.max(0, count - 3) }, (_, i) => makeEdge(p(i), p(i + 3)));
	return [...chain, ...skips];
}

/** A single FLAT group of `count` members with the given intra-group link shape. */
function flatFixture(count: number, shape: LinkShape): VicinityGraph {
	const folder = "notes";
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("root.md"), folder: asFolderPath(""), isCentral: true, isMain: true }),
			...Array.from({ length: count }, (_, i) => memberNode(folder, "m", i)),
		],
		edges: [makeEdge("root.md", `${folder}/m0.md`), ...shapeEdges(folder, "m", count, shape)],
	});
}

/** Two subgroups nested under a parent, each edged; plus a cross-subgroup edge. */
function nestedFixture(count: number, shape: LinkShape): VicinityGraph {
	const a = "sql/joins";
	const b = "sql/windows";
	return makeGraph({
		nodes: [
			makeNode({ path: asVaultPath("root.md"), folder: asFolderPath(""), isCentral: true, isMain: true }),
			...Array.from({ length: count }, (_, i) => memberNode(a, "j", i)),
			...Array.from({ length: count }, (_, i) => memberNode(b, "w", i)),
		],
		edges: [
			makeEdge("root.md", `${a}/j0.md`),
			makeEdge(`${a}/j0.md`, `${b}/w0.md`),
			...shapeEdges(a, "j", count, shape),
			...shapeEdges(b, "w", count, shape),
		],
	});
}

const COUNTS = [4, 8, 12, 16, 20];
const SHAPES: LinkShape[] = ["none", "hub", "chain", "dense"];
const CANDIDATES: Candidate[] = ["rectpacking", "force", "force-rectseed", "stress"];

describe.runIf(RUN_EVAL)("interior-layout evaluation", () => {
	it("sweeps candidates over nested + edged fixtures and writes .out/interior-eval.md", async () => {
		interface Row {
			readonly nesting: string;
			readonly count: number;
			readonly shape: LinkShape;
			readonly candidate: Candidate;
			readonly m: Metrics;
		}
		const rows: Row[] = [];
		const fixtures: { nesting: string; make: (c: number, s: LinkShape) => VicinityGraph }[] = [
			{ nesting: "flat", make: flatFixture },
			{ nesting: "nested", make: nestedFixture },
		];
		for (const fx of fixtures) {
			for (const count of COUNTS) {
				for (const shape of SHAPES) {
					const graph = fx.make(count, shape);
					for (const candidate of CANDIDATES) {
						const m = await measure(graph, candidate);
						rows.push({ nesting: fx.nesting, count, shape, candidate, m });
					}
				}
			}
		}

		// Aggregate per candidate.
		const agg = new Map<Candidate, { boxArea: number; fill: number; edgeLen: number; cross: number; time: number; n: number; edged: number; edgeLenEdged: number; crossEdged: number }>();
		for (const c of CANDIDATES) agg.set(c, { boxArea: 0, fill: 0, edgeLen: 0, cross: 0, time: 0, n: 0, edged: 0, edgeLenEdged: 0, crossEdged: 0 });
		for (const r of rows) {
			const a = agg.get(r.candidate);
			if (a === undefined) continue;
			a.boxArea += r.m.groupBoxAreaPx;
			a.fill += r.m.fillRatio;
			a.time += r.m.timeMs;
			a.n += 1;
			if (r.m.edgeCount > 0) {
				a.edged += 1;
				a.edgeLenEdged += r.m.edgeLenPx;
				a.crossEdged += r.m.crossings;
			}
		}

		const fmt = (n: number, d = 1) => n.toFixed(d);
		const baseline = agg.get("rectpacking");
		let md = "# Interior layout candidate sweep\n\n";
		md += `Fixtures: {flat, nested} x counts {${COUNTS.join(", ")}} x shapes {${SHAPES.join(", ")}} = ${rows.length / CANDIDATES.length} graphs per candidate.\n\n`;
		md += "## Aggregate\n\n";
		md += "| candidate | mean box area | box area vs base | mean fill | mean edge len (edged) | total crossings (edged) | mean time/graph ms | max time ms |\n";
		md += "|---|---|---|---|---|---|---|---|\n";
		const maxTimeByCand = new Map<Candidate, number>();
		for (const r of rows) maxTimeByCand.set(r.candidate, Math.max(maxTimeByCand.get(r.candidate) ?? 0, r.m.timeMs));
		for (const c of CANDIDATES) {
			const a = agg.get(c);
			const b = baseline;
			if (a === undefined || b === undefined) continue;
			const meanBox = a.boxArea / a.n;
			const baseBox = b.boxArea / b.n;
			const vsBase = ((meanBox - baseBox) / baseBox) * 100;
			md += `| ${c} | ${fmt(meanBox, 0)} | ${vsBase >= 0 ? "+" : ""}${fmt(vsBase)}% | ${fmt(a.fill / a.n, 3)} | ${fmt(a.edgeLenEdged / Math.max(1, a.edged), 0)} | ${a.crossEdged} | ${fmt(a.time / a.n, 2)} | ${fmt(maxTimeByCand.get(c) ?? 0, 1)} |\n`;
		}

		// Per-shape crossings and edge length (edged shapes only), aggregated over counts+nesting.
		md += "\n## Edge quality by shape (edged shapes only)\n\n";
		md += "| shape | candidate | mean edge len | total crossings |\n|---|---|---|---|\n";
		for (const shape of SHAPES) {
			if (shape === "none") continue;
			for (const c of CANDIDATES) {
				const rs = rows.filter((r) => r.shape === shape && r.candidate === c);
				const len = rs.reduce((s, r) => s + r.m.edgeLenPx, 0) / rs.length;
				const cross = rs.reduce((s, r) => s + r.m.crossings, 0);
				md += `| ${shape} | ${c} | ${fmt(len, 0)} | ${cross} |\n`;
			}
		}

		md += "\n## Full rows\n\n";
		md += "| nesting | count | shape | candidate | box area | fill | edge len | crossings | time ms |\n|---|---|---|---|---|---|---|---|---|\n";
		for (const r of rows) {
			md += `| ${r.nesting} | ${r.count} | ${r.shape} | ${r.candidate} | ${fmt(r.m.groupBoxAreaPx, 0)} | ${fmt(r.m.fillRatio, 3)} | ${fmt(r.m.edgeLenPx, 0)} | ${r.m.crossings} | ${fmt(r.m.timeMs, 1)} |\n`;
		}

		mkdirSync(".out", { recursive: true });
		writeFileSync(".out/interior-eval.md", md);

		// Findings that back the escalation (see the ticket): edge-awareness is real
		// — force cuts intra-group crossings well past the 20% envelope bar — while
		// stress is disqualified on correctness (it OVERLAPS members: a group's own
		// members no longer fit their bounding box, fill ratio > 1).
		const rectCross = agg.get("rectpacking")?.crossEdged ?? 0;
		const forceCross = agg.get("force")?.crossEdged ?? 0;
		expect(forceCross).toBeLessThan(rectCross * 0.8);
		const stressOverlaps = rows.some((r) => r.candidate === "stress" && r.m.fillRatio > 1);
		expect(stressOverlaps).toBe(true);
	}, 120000);
});
