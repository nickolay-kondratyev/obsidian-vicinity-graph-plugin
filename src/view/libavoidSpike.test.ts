// THROWAWAY — Phase 0 spike verification for ticket edge-routing__00-wasm-spike
// (nid_pgsj1vjjnmtflf55a4sd9txos_e). Delete alongside libavoidSpike.ts in Phase 1.
//
// Exercises the REAL libavoid WASM engine (resolved to the node build under vitest's
// node env) through the same scenario logic the shipped Obsidian command runs. This
// deterministically proves obstacle avoidance, nested-shape endpoints, and the 100x
// create/destroy memory pattern in CI. It does NOT prove the browser/data-URL load
// path inside Electron — that is Chromium-only (see IMPLEMENTATION_WITH_SELF_PLAN__PUBLIC.md).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import type { Avoid } from "./libavoidLoader";
import { runNestedScenario, runObstacleScenario, runStressLoop } from "./libavoidSpike";

const STRESS_ITERATIONS = 100;
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d]; // "\0asm"

const require = createRequire(import.meta.url);
/** libavoid-js's node build (same wasm engine as the shipped browser build). */
const LIBAVOID_NODE_BUILD = require.resolve("libavoid-js");

let avoid: Avoid;

beforeAll(async () => {
	// Load the NODE build explicitly by file URL. A bare `import "libavoid-js"`
	// under vitest resolves to the BROWSER build (data-URL/fetch load), which is
	// Chromium-only and aborts in Node; the node build reads the wasm off disk.
	// The wasm engine — and thus the routing behavior asserted below — is identical.
	const libavoid = (await import(pathToFileURL(LIBAVOID_NODE_BUILD).href)) as {
		AvoidLib: { load(path?: string): Promise<void>; getInstance(): unknown };
	};
	await libavoid.AvoidLib.load();
	avoid = libavoid.AvoidLib.getInstance() as Avoid;
});

describe("libavoid WASM spike", () => {
	it("embedded wasm bytes are a valid WebAssembly module", async () => {
		const wasmPath = path.join(path.dirname(LIBAVOID_NODE_BUILD), "libavoid.wasm");
		const bytes = readFileSync(wasmPath);
		expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual(WASM_MAGIC);
		await expect(WebAssembly.compile(bytes)).resolves.toBeInstanceOf(WebAssembly.Module);
	});

	it("scenario (a): routes a connector AROUND a rectangle obstacle", () => {
		const result = runObstacleScenario(avoid);
		expect(result.pointCount).toBeGreaterThan(2);
		expect(result.anyPointInsideObstacle).toBe(false);
	});

	it("scenario (b): a shape nested inside a group routes out and avoids outside obstacles", () => {
		const result = runNestedScenario(avoid);
		expect(result.startsAtChildCentre).toBe(true);
		expect(result.avoidsOutsideObstacle).toBe(true);
		expect(result.pointCount).toBeGreaterThan(2);
	});

	it(`scenario (c): ${STRESS_ITERATIONS}x create/route/destroy completes without crash`, () => {
		const result = runStressLoop(avoid, STRESS_ITERATIONS);
		expect(result.completed).toBe(STRESS_ITERATIONS);
		expect(result.allProducedValidRoute).toBe(true);
	});
});
