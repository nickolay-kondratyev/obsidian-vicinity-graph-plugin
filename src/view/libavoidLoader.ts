import { AvoidLib } from "libavoid-js";
import libavoidWasmBinary from "libavoid-wasm";

// Loader shim for the libavoid-js WASM routing engine.
//
// The plugin ships as a single `main.js` with the wasm embedded as raw bytes (see
// esbuild.config.mjs). This module owns turning those bytes into a live `Avoid`
// instance, OFFLINE (no network fetch), and hands Phase 1's edge-routing pass a
// clean, lazy, singleton-cached entry point. Nothing loads at plugin startup;
// the first `loadAvoid()` call initializes and every later call returns the cache.
//
// We resolve libavoid-js to its NODE build (esbuild.config.mjs) so the shipped
// `main.js` carries none of the web glue's `fetch(` / `instantiateStreaming` tokens
// that the Obsidian scanner flags as network calls. The node build normally reads
// the wasm off disk via `readFileSync`, but a single-file plugin bundle has no
// on-disk `libavoid.wasm`, so we hand it the embedded bytes as Emscripten's
// `wasmBinary` — that byte injection is what keeps it fully offline AND stops it
// ever reaching the disk path. See the node-build plugin in esbuild.config.mjs.

/**
 * The libavoid WebIDL binding surface (`AvoidLib.getInstance()`), typed for the
 * members this plugin uses. libavoid-js ships no usable types (its declaration is
 * an untyped `declare module`), so we narrow to a focused, honest interface here;
 * the index signature covers the long tail of enum constants / bindings we do not
 * name explicitly. Every `new`-ed binding must be freed via `destroy` — Phase 1
 * wraps this so leaks are impossible at call sites.
 */
export interface Avoid {
	readonly PolyLineRouting: number;
	readonly OrthogonalRouting: number;
	// ConnDirFlags: allowed connector approach/leave directions (a bitmask). The
	// upstream .d.ts ships ConnDirFlags as an EMPTY enum, so these live only on the
	// runtime binding — named here so boundary pins pick a facing direction without
	// `as number` casts (edge-routing__04). ConnDirAll = every direction.
	readonly ConnDirUp: number;
	readonly ConnDirDown: number;
	readonly ConnDirLeft: number;
	readonly ConnDirRight: number;
	readonly ConnDirAll: number;
	readonly shapeBufferDistance: number;
	readonly segmentPenalty: number;
	readonly crossingPenalty: number;

	Point: new (x: number, y: number) => AvoidPoint;
	Rectangle: new (topLeft: AvoidPoint, bottomRight: AvoidPoint) => AvoidRectangle;
	Router: new (routingFlag: number) => AvoidRouter;
	ShapeRef: new (router: AvoidRouter, poly: AvoidRectangle) => AvoidShapeRef;
	ShapeConnectionPin: new (
		shape: AvoidShapeRef,
		classId: number,
		xOffset: number,
		yOffset: number,
		proportional: boolean,
		insideOffset: number,
		visDirs: number,
	) => AvoidShapeConnectionPin;
	ConnEnd: new (shapeOrPoint: AvoidShapeRef | AvoidPoint, classId?: number) => AvoidConnEnd;
	ConnRef: new (router: AvoidRouter, src: AvoidConnEnd, dst: AvoidConnEnd) => AvoidConnRef;

	destroy(obj: unknown): void;

	// The binding exposes ~300 enum constants / helpers flat on the instance.
	readonly [key: string]: unknown;
}

export interface AvoidPoint {
	x: number;
	y: number;
}
export interface AvoidRectangle {
	readonly __rectangle: unique symbol;
}
export interface AvoidShapeRef {
	readonly __shapeRef: unique symbol;
}
export interface AvoidConnEnd {
	readonly __connEnd: unique symbol;
}
/**
 * A connection pin registered on a shape. Router-owned: never `destroy()` it.
 *
 * Exclusivity is the only knob we use, and its default is derived from the pin's
 * visibility directions — hence `isExclusive()`, the honest way to observe what a
 * freshly constructed pin actually is. Mechanism and measurements live at the single
 * call site: `registerPinsForShape` in `edgeRouting.ts` (ticket edge-routing__06 item
 * (a)). The binding also exposes `setConnectionCost`, left deliberately UNTYPED: pin
 * costs are a measured negative result (edge-routing__05,
 * `docs-internal/research/facing-side-edge-attachment.md`) and must stay unreachable.
 */
export interface AvoidShapeConnectionPin {
	setExclusive(exclusive: boolean): void;
	isExclusive(): boolean;
}
export interface AvoidPolyLine {
	size(): number;
	get_ps(index: number): AvoidPoint;
}
export interface AvoidRouter {
	processTransaction(): void;
	setRoutingParameter(parameter: number, value: number): void;
	setRoutingOption(option: number, value: boolean): void;
}
export interface AvoidConnRef {
	displayRoute(): AvoidPolyLine;
}

/**
 * The `globalThis` key the embedded wasm bytes are published on. esbuild's node-build
 * plugin injects `wasmBinary: globalThis.__VICINITY_LIBAVOID_WASM_BINARY__` into the
 * Emscripten module options, because the shipped `AvoidLib.load(filePath?)` wrapper
 * exposes no other seam to hand bytes to the factory. Kept in lockstep with
 * LIBAVOID_WASM_BINARY_GLOBAL in esbuild.config.mjs.
 */
const WASM_BINARY_GLOBAL = "__VICINITY_LIBAVOID_WASM_BINARY__";

let cached: Promise<Avoid> | null = null;

/**
 * Lazily initialize the libavoid engine from the embedded wasm and return the
 * singleton `Avoid` instance. Safe to call repeatedly. Throws if the wasm cannot
 * be instantiated — callers (the routing pass) contain that failure and fall back
 * to straight edges.
 *
 * Only a SUCCESSFUL instance is memoized. WHY: caching a rejected promise would
 * lock the whole session into straight edges after a single transient init failure
 * (e.g. a one-off Electron/Chromium hiccup instantiating the data: wasm) with no
 * way to recover short of a plugin reload. We instead clear the cached slot on
 * failure so a later call — a different view or a subsequent routing pass — gets a
 * fresh attempt. The failure still surfaces to THIS caller (we return the rejecting
 * promise); we never swallow it. Concurrent callers continue to share one in-flight
 * promise (assigned synchronously before we return), so there is no double-load race.
 * Phase 1's `LibavoidEdgeRouter` inherits this retry-on-failure contract.
 */
export function loadAvoid(): Promise<Avoid> {
	if (cached === null) {
		const attempt = initAvoid();
		cached = attempt;
		// Reset only if this failed attempt is still the cached one, so a retry
		// already in flight (a newer attempt) is never clobbered. This `.catch`
		// is a side-effect handler; the error is still delivered to callers via
		// the `attempt` promise returned below.
		attempt.catch(() => {
			if (cached === attempt) {
				cached = null;
			}
		});
	}
	return cached;
}

async function initAvoid(): Promise<Avoid> {
	// Publish the embedded bytes where the injected `wasmBinary` option reads them
	// (see WASM_BINARY_GLOBAL / esbuild.config.mjs), THEN load. The node build's
	// `load()` ignores its `filePath` argument once `wasmBinary` is set, so we pass
	// none: Emscripten instantiates from these bytes and never touches disk or the
	// network. If instantiation throws we surface it (the routing pass logs once and
	// renders straight edges) rather than pretending a fallback ran.
	//
	// MUST stay `globalThis`, NOT `window`/`activeWindow` (what obsidianmd/no-global-this
	// would push us to): esbuild's node-build plugin injects the LITERAL token
	// `globalThis.__VICINITY_LIBAVOID_WASM_BINARY__` as the Emscripten `wasmBinary` source
	// (esbuild.config.mjs, LIBAVOID_WASM_BINARY_GLOBAL). The publish must land on the EXACT
	// object that injected read dereferences; a singleton wasm load shared across every
	// popout wants the one cross-window global, and in a popout `activeWindow !== globalThis`,
	// so scoping to a window would strand the bytes on the wrong object. The rule is scoped
	// off for this ONE file in eslint.config.mjs (inline directives are banned for obsidianmd/*).
	(globalThis as Record<string, unknown>)[WASM_BINARY_GLOBAL] = libavoidWasmBinary;
	await AvoidLib.load();
	// libavoid-js's own declaration exports a different (thinner) `Avoid` shape, so
	// route through `unknown` — the binding really is the instance we narrow here.
	return AvoidLib.getInstance() as unknown as Avoid;
}
