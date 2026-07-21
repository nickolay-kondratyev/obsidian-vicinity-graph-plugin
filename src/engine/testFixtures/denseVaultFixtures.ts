import type { FakeFileSpec, FakeVaultSpec } from "../FakeLinkProvider";

/**
 * Committed, deterministic dense-vault fixture generator (step-07 hardening).
 *
 * WHY committed (not throwaway): these shapes are the regression harness the V2
 * layout work will lean on — a hub with hundreds of spokes, long chains, dense
 * bidirectional clusters, folder-size variety and canvas-bearing sets are the
 * pathological inputs that stress truncation, sizing and (later) layout. Keeping
 * them typed, DRY and documented pays off every time layout changes.
 *
 * DETERMINISM CONTRACT: every builder is a pure function of its arguments. Sizes
 * that need variety use {@link SeededRandom} (never `Math.random`), and every
 * path uses zero-padded indices so lexicographic order — the truncator's final
 * tiebreaker — is stable and human-predictable. Build the same fixture twice and
 * you get structurally identical specs.
 *
 * FakeLinkProvider throws on a link to an undeclared path, so every builder
 * declares all referenced files before wiring links (the self-test enforces this).
 */

/** A generated fixture plus the metadata tests need to drive and assert on it. */
export interface DenseFixture {
	readonly spec: FakeVaultSpec;
	/** The MAIN root path (first root). */
	readonly mainPath: string;
	/** Additional central (pinned) roots, when the shape has any. */
	readonly pinnedPaths?: readonly string[];
	/** Count of node-bearing files (`.md`/`.canvas`) — the max reachable node count. */
	readonly nodeBearingCount: number;
	/** Outgoing depth from MAIN needed to reach every node-bearing file (incoming depth 0). */
	readonly depthToCoverAll: number;
}

/**
 * Mulberry32 — a tiny, fast, well-distributed seeded PRNG. Used only to give
 * fixture files reproducible size variety; NOT cryptographic. Same seed → same
 * sequence, which is the whole point (deterministic fixtures).
 */
export class SeededRandom {
	private state: number;

	constructor(seed: number) {
		this.state = seed >>> 0;
	}

	/** Next value in [0, 1). */
	nextUnitFloat(): number {
		this.state = (this.state + 0x6d2b79f5) | 0;
		let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/** Next integer in [0, maxExclusive). */
	nextInt(maxExclusive: number): number {
		return Math.floor(this.nextUnitFloat() * maxExclusive);
	}
}

/** Zero-padded index so path lexicographic order matches numeric order. */
function pad(index: number, width: number): string {
	return String(index).padStart(width, "0");
}

/** Digit width sufficient to zero-pad indices in `[0, count)`. */
function widthFor(count: number): number {
	return String(Math.max(0, count - 1)).length;
}

const MAX_FIXTURE_FILE_BYTES = 100_000;

/** Equal size for neighbors whose fixture must let a LATER tiebreaker level decide. */
const UNIFORM_NEIGHBOR_BYTES = 1_000;

const DEFAULT_HUB_SPOKE_COUNT = 220;
const DEFAULT_CHAIN_LENGTH = 60;
const DEFAULT_CLUSTER_COUNT = 5;
const DEFAULT_CLUSTER_MEMBERS = 8;
const DEFAULT_MANY_FOLDER_MEMBERS = 30;
const DEFAULT_CANVAS_COUNT = 30;
const DEFAULT_LARGE_SPOKE_COUNT = 460;
const DEFAULT_LARGE_CHILD_EVERY = 10;

/**
 * Hub note fanning out to `spokeCount` (default 220 — "200+ links") leaf spokes,
 * all at depth 1. Stresses a single node's out-degree and same-depth tiebreaking.
 */
export function hubFanOut(spokeCount: number = DEFAULT_HUB_SPOKE_COUNT, seed = 1): DenseFixture {
	const random = new SeededRandom(seed);
	const width = widthFor(spokeCount);
	const files: FakeFileSpec[] = [{ path: "hub.md", sizeBytes: MAX_FIXTURE_FILE_BYTES }];
	const spokes: string[] = [];
	for (let i = 0; i < spokeCount; i++) {
		const path = `spokes/s${pad(i, width)}.md`;
		spokes.push(path);
		files.push({ path, sizeBytes: random.nextInt(MAX_FIXTURE_FILE_BYTES) });
	}
	return {
		spec: { files, links: { "hub.md": spokes } },
		mainPath: "hub.md",
		nodeBearingCount: files.length,
		depthToCoverAll: 1,
	};
}

/**
 * A single long linear chain `c000 → c001 → … ` of `length` node-bearing files.
 * Stresses deep traversal: every node's minDepth equals its index.
 */
export function deepChain(length: number = DEFAULT_CHAIN_LENGTH, seed = 2): DenseFixture {
	const random = new SeededRandom(seed);
	const width = widthFor(length);
	const files: FakeFileSpec[] = [];
	const links: Record<string, string[]> = {};
	for (let i = 0; i < length; i++) {
		const path = `chain/c${pad(i, width)}.md`;
		files.push({ path, sizeBytes: random.nextInt(MAX_FIXTURE_FILE_BYTES) });
		if (i > 0) {
			links[`chain/c${pad(i - 1, width)}.md`] = [path];
		}
	}
	return {
		spec: { files, links },
		mainPath: `chain/c${pad(0, width)}.md`,
		nodeBearingCount: length,
		depthToCoverAll: Math.max(1, length - 1),
	};
}

/**
 * `clusterCount` folders, each a fully bidirectional clique of `membersPerCluster`
 * notes (every ordered pair linked → every pair mutually links). A hub links to
 * the first member of each cluster, so every member is reachable within depth 2.
 * Stresses dense edge sets and cross-linking.
 */
export function bidirectionalClusters(
	clusterCount: number = DEFAULT_CLUSTER_COUNT,
	membersPerCluster: number = DEFAULT_CLUSTER_MEMBERS,
	seed = 3,
): DenseFixture {
	const random = new SeededRandom(seed);
	const memberWidth = widthFor(membersPerCluster);
	const clusterWidth = widthFor(clusterCount);
	const files: FakeFileSpec[] = [{ path: "hub.md", sizeBytes: MAX_FIXTURE_FILE_BYTES }];
	const links: Record<string, string[]> = { "hub.md": [] };
	for (let c = 0; c < clusterCount; c++) {
		const folder = `cluster${pad(c, clusterWidth)}`;
		const members: string[] = [];
		for (let m = 0; m < membersPerCluster; m++) {
			const path = `${folder}/m${pad(m, memberWidth)}.md`;
			members.push(path);
			files.push({ path, sizeBytes: random.nextInt(MAX_FIXTURE_FILE_BYTES) });
		}
		(links["hub.md"] as string[]).push(members[0] as string);
		for (const source of members) {
			links[source] = members.filter((target) => target !== source);
		}
	}
	return {
		spec: { files, links },
		mainPath: "hub.md",
		nodeBearingCount: files.length,
		depthToCoverAll: 2,
	};
}

/**
 * One graph containing folders of every membership class the folder-grouping rule
 * cares about: a 1-member folder, a 2-member folder, a many-member folder, plus
 * vault-root files. Everything hangs off the hub at depth 1.
 */
export function foldersWithMemberCounts(manyCount: number = DEFAULT_MANY_FOLDER_MEMBERS, seed = 4): DenseFixture {
	const random = new SeededRandom(seed);
	const files: FakeFileSpec[] = [{ path: "hub.md", sizeBytes: MAX_FIXTURE_FILE_BYTES }];
	const targets: string[] = [];
	const declare = (path: string): void => {
		files.push({ path, sizeBytes: random.nextInt(MAX_FIXTURE_FILE_BYTES) });
		targets.push(path);
	};
	declare("solo/only.md");
	declare("pair/p0.md");
	declare("pair/p1.md");
	const width = widthFor(manyCount);
	for (let i = 0; i < manyCount; i++) {
		declare(`many/m${pad(i, width)}.md`);
	}
	declare("rootA.md");
	declare("rootB.md");
	return {
		spec: { files, links: { "hub.md": targets } },
		mainPath: "hub.md",
		nodeBearingCount: files.length,
		depthToCoverAll: 1,
	};
}

/**
 * Canvas-heavy set: `count` node-bearing `.canvas` files linked from the hub, at
 * depth 1. Confirms `.canvas` files are treated as first-class nodes at scale.
 */
export function canvasHeavy(count: number = DEFAULT_CANVAS_COUNT, seed = 5): DenseFixture {
	const random = new SeededRandom(seed);
	const width = widthFor(count);
	const files: FakeFileSpec[] = [{ path: "hub.md", sizeBytes: MAX_FIXTURE_FILE_BYTES }];
	const canvases: string[] = [];
	for (let i = 0; i < count; i++) {
		const path = `boards/board${pad(i, width)}.canvas`;
		canvases.push(path);
		files.push({ path, sizeBytes: random.nextInt(MAX_FIXTURE_FILE_BYTES) });
	}
	return {
		spec: { files, links: { "hub.md": canvases } },
		mainPath: "hub.md",
		nodeBearingCount: files.length,
		depthToCoverAll: 1,
	};
}

/**
 * A ~500-node mixed vault for cap/determinism/timing regression: a hub fanning
 * out to `spokeCount` spokes spread across ten folders (depth 1), and every
 * `childEvery`-th spoke owning one unique second-hop child (depth 2). Sizes are
 * seeded so truncation ordering is non-trivial (not all-tie). This is the
 * fixture the loose <150ms engine-build ceiling is measured against.
 */
export function largeMixedVault(
	spokeCount: number = DEFAULT_LARGE_SPOKE_COUNT,
	childEvery: number = DEFAULT_LARGE_CHILD_EVERY,
	seed = 6,
): DenseFixture {
	const random = new SeededRandom(seed);
	const spokeWidth = widthFor(spokeCount);
	const folderCount = 10;
	const files: FakeFileSpec[] = [{ path: "hub.md", sizeBytes: MAX_FIXTURE_FILE_BYTES }];
	const links: Record<string, string[]> = { "hub.md": [] };
	for (let i = 0; i < spokeCount; i++) {
		const folder = `f${pad(i % folderCount, 2)}`;
		const spoke = `${folder}/s${pad(i, spokeWidth)}.md`;
		files.push({ path: spoke, sizeBytes: random.nextInt(MAX_FIXTURE_FILE_BYTES) });
		(links["hub.md"] as string[]).push(spoke);
		if (i % childEvery === 0) {
			const child = `${folder}/child${pad(i, spokeWidth)}.md`;
			files.push({ path: child, sizeBytes: random.nextInt(MAX_FIXTURE_FILE_BYTES) });
			links[spoke] = [child];
		}
	}
	return {
		spec: { files, links },
		mainPath: "hub.md",
		nodeBearingCount: files.length,
		depthToCoverAll: 2,
	};
}

/**
 * A pinned central whose vicinity is fully disconnected from MAIN, for tight-cap
 * scenarios. MAIN's connected neighbors and the pin's disconnected neighbors compete
 * for the cap; the pin and MAIN themselves are cap-exempt centrals.
 *
 * WHY uniform neighbor sizes: every neighbor is one hop from its root (equal minDepth)
 * AND equal-sized (equal sizeScore) so the ONLY thing separating a connected neighbor
 * from a disconnected one is `distanceToMain` — the present-beats-absent tiebreaker we
 * want this fixture to exercise. Random sizes would let sizeScore (an earlier level)
 * decide first and mask it.
 */
export function pinnedDisconnectedVault(connectedNeighbors = 3, disconnectedNeighbors = 3): DenseFixture {
	const files: FakeFileSpec[] = [
		{ path: "hub.md", sizeBytes: MAX_FIXTURE_FILE_BYTES },
		{ path: "island/pin.md", sizeBytes: MAX_FIXTURE_FILE_BYTES },
	];
	const hubTargets: string[] = [];
	const pinTargets: string[] = [];
	const connectedWidth = widthFor(connectedNeighbors);
	const disconnectedWidth = widthFor(disconnectedNeighbors);
	for (let i = 0; i < connectedNeighbors; i++) {
		const path = `connected/c${pad(i, connectedWidth)}.md`;
		files.push({ path, sizeBytes: UNIFORM_NEIGHBOR_BYTES });
		hubTargets.push(path);
	}
	for (let i = 0; i < disconnectedNeighbors; i++) {
		const path = `island/i${pad(i, disconnectedWidth)}.md`;
		files.push({ path, sizeBytes: UNIFORM_NEIGHBOR_BYTES });
		pinTargets.push(path);
	}
	return {
		spec: { files, links: { "hub.md": hubTargets, "island/pin.md": pinTargets } },
		mainPath: "hub.md",
		pinnedPaths: ["island/pin.md"],
		nodeBearingCount: files.length,
		depthToCoverAll: 1,
	};
}

/** Every builder invoked with defaults — drives the construction self-test. */
export function allDefaultDenseFixtures(): Readonly<Record<string, DenseFixture>> {
	return {
		hubFanOut: hubFanOut(),
		deepChain: deepChain(),
		bidirectionalClusters: bidirectionalClusters(),
		foldersWithMemberCounts: foldersWithMemberCounts(),
		canvasHeavy: canvasHeavy(),
		largeMixedVault: largeMixedVault(),
		pinnedDisconnectedVault: pinnedDisconnectedVault(),
	};
}
