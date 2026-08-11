// Ambient declaration for the embedded libavoid WASM engine bytes.
//
// WHY a virtual specifier (not `import ... from "libavoid-js/dist/libavoid.wasm"`):
// the `libavoid-js` package.json `exports` map only publishes the `.` entry, so
// esbuild (and Node) BLOCK any deep subpath import of the raw `.wasm` file
// (ERR_PACKAGE_PATH_NOT_EXPORTED). `esbuild.config.mjs` therefore registers an
// `onResolve` plugin that maps this stable virtual id to the real `dist/libavoid.wasm`
// on disk, which the `{ ".wasm": "binary" }` loader then inlines as a Uint8Array.
// This module id only exists at bundle time; tsc/vitest need this declaration to type it.
declare module "libavoid-wasm" {
	/** The libavoid WASM binary, inlined into `main.js` by esbuild as raw bytes. */
	const libavoidWasmBinary: Uint8Array;
	export default libavoidWasmBinary;
}
