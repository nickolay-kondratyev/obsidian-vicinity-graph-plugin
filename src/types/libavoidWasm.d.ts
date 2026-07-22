// Ambient declaration for the base64-embedded libavoid WASM engine.
//
// WHY a virtual specifier (not `import ... from "libavoid-js/dist/libavoid.wasm"`):
// the `libavoid-js` package.json `exports` map only publishes the `.` entry, so
// esbuild (and Node) BLOCK any deep subpath import of the raw `.wasm` file
// (ERR_PACKAGE_PATH_NOT_EXPORTED). `esbuild.config.mjs` therefore registers an
// `onResolve` plugin that maps this stable virtual id to the real `dist/libavoid.wasm`
// on disk, which the `{ ".wasm": "base64" }` loader then inlines as a base64 string.
// This module id only exists at bundle time; tsc/vitest need this declaration to type it.
declare module "libavoid-wasm" {
	/** The libavoid WASM binary, base64-encoded and inlined into `main.js` by esbuild. */
	const libavoidWasmBase64: string;
	export default libavoidWasmBase64;
}
