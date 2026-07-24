import { AvoidLib } from "libavoid-js";
import libavoidWasmBase64 from "libavoid-wasm";

// Loader shim for the libavoid-js WASM routing engine.
//
// The plugin ships as a single `main.js` with the wasm embedded as base64 (see
// esbuild.config.mjs). This module owns turning that base64 into a live `Avoid`
// instance, OFFLINE (no network fetch), and hands Phase 1's edge-routing pass a
// clean, lazy, singleton-cached entry point. Nothing loads at plugin startup;
// the first `loadAvoid()` call initializes and every later call returns the cache.

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
 * Exclusivity is the only knob we use — an exclusive pin accepts at most one
 * connector, so a shape's pins run out and libavoid falls back to the shape centre
 * (ticket edge-routing__06). Its default is derived from the pin's visibility
 * directions, hence `isExclusive()`: it is the honest way to observe what a freshly
 * constructed pin actually is. The binding also exposes `setConnectionCost`, left
 * deliberately UNTYPED: pin costs are a measured negative result (edge-routing__05,
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
 * How the wasm bytes reach the Emscripten module. PRIMARY (`data-url`) is what we
 * ship: `AvoidLib.load(dataUrl)` routes the data: URL through Emscripten's
 * `locateFile`, and Chromium/Electron `fetch()` accepts data: URLs — so the wasm
 * loads with zero network. The `wasm-binary` fallback exists as a documented
 * escape hatch only; see `loadAvoid`.
 */
export type WasmLoadPath = "data-url" | "wasm-binary";

const WASM_DATA_URL = `data:application/octet-stream;base64,${libavoidWasmBase64}`;

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
	// PRIMARY path: hand the data: URL to AvoidLib.load → Emscripten locateFile →
	// fetch(data:) inside Electron/Chromium. This is the path verified for the
	// plugin runtime; the WEBIDL binder exposes no public factory hook to inject
	// `wasmBinary` on the browser build, so if this throws we surface it (the
	// routing pass logs once and renders straight edges) rather than silently
	// pretending a fallback ran.
	await AvoidLib.load(WASM_DATA_URL);
	// libavoid-js's own declaration exports a different (thinner) `Avoid` shape, so
	// route through `unknown` — the binding really is the instance we narrow here.
	return AvoidLib.getInstance() as unknown as Avoid;
}
