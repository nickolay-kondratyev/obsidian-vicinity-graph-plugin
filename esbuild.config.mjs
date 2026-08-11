import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { builtinModules, createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

// libavoid-js ships its WASM engine as a sidecar `dist/libavoid.wasm`, but the
// plugin ships as a SINGLE `main.js` with no file sidecars and no runtime network
// fetch — so the wasm must be embedded. The package `exports` map only publishes
// `.`, so a direct deep import of the `.wasm` is blocked (ERR_PACKAGE_PATH_NOT_EXPORTED);
// we instead resolve the file off the resolvable package entry and expose it under a
// stable virtual id that the base64 loader inlines. See src/types/libavoidWasm.d.ts.
const LIBAVOID_WASM_VIRTUAL_ID = "libavoid-wasm";
const LIBAVOID_DIST_DIR = path.dirname(require.resolve("libavoid-js"));
const LIBAVOID_WASM_PATH = path.join(LIBAVOID_DIST_DIR, "libavoid.wasm");

/** Maps the `libavoid-wasm` virtual import to the on-disk wasm; `loader['.wasm']` then inlines it as bytes. */
const libavoidWasmPlugin = {
	name: "libavoid-wasm",
	setup(build) {
		build.onResolve({ filter: /^libavoid-wasm$/ }, () => ({ path: LIBAVOID_WASM_PATH }));
	},
};

// libavoid-js ships two builds: the WEB build (`dist/index.js`, the package's `default`
// export) and the NODE build (`dist/index-node.mjs`, its `node` export). The web build's
// Emscripten glue contains `fetch(` / `instantiateStreaming` tokens; the Obsidian community
// scanner's STATIC TEXT scan of `main.js` flags those as network calls and paints a
// user-facing "risk" badge — a false positive (we load the wasm from embedded bytes, zero
// egress) that a human disclosure cannot clear. The node build has ZERO such tokens.
//
// So we resolve `libavoid-js` to the node entry and adapt it for the single-file plugin
// bundle. Two adaptations, both keyed on STABLE anchors (not minified identifiers) so a
// libavoid-js version bump either keeps working or fails this build LOUDLY:
//
//  1. `import.meta.url` — the node build runs `createRequire(import.meta.url)` at module
//     eval and `new URL(..., import.meta.url)` inside `load()`. In our CJS bundle
//     `import.meta.url` is empty, so both throw. We only require() builtins (fs/path/url)
//     and NEVER read the wasm off disk (see 2), so any well-formed absolute file URL works.
//  2. `wasmBinary` — the node build honours a `Module.wasmBinary` byte injection, but the
//     shipped `AvoidLib.load(filePath?)` wrapper does not forward it (it only builds
//     `{locateFile}`). We inject `wasmBinary` into that one options object, sourced from
//     the embedded bytes the loader publishes on `globalThis` before calling `load()`.
//     With `wasmBinary` set, Emscripten never reaches its `readFileSync` fallback — the
//     single-file bundle has no on-disk `libavoid.wasm` — and never touches the network.
const LIBAVOID_NODE_ENTRY = path.join(LIBAVOID_DIST_DIR, "index-node.mjs");
// A well-formed absolute file URL standing in for the node build's `import.meta.url`. It
// need not exist: only builtin (fs/path/url) requires run against it, and the wasm path it
// would derive is never read (wasmBinary short-circuits it). See src/view/libavoidLoader.ts.
const LIBAVOID_META_URL_SHIM = JSON.stringify("file:///vicinity-graph-libavoid/index-node.mjs");
// The global the loader publishes the embedded wasm bytes on; the injected `wasmBinary`
// reads it. Kept in lockstep with LIBAVOID_WASM_BINARY_GLOBAL in src/view/libavoidLoader.ts.
const LIBAVOID_WASM_BINARY_GLOBAL = "globalThis.__VICINITY_LIBAVOID_WASM_BINARY__";

/** Resolves `libavoid-js` to its node build and applies the two adaptations documented above. */
const libavoidNodeBuildPlugin = {
	name: "libavoid-node-build",
	setup(build) {
		build.onResolve({ filter: /^libavoid-js$/ }, () => ({ path: LIBAVOID_NODE_ENTRY }));
		build.onLoad({ filter: /index-node\.mjs$/ }, () => {
			const source = fs.readFileSync(LIBAVOID_NODE_ENTRY, "utf8");
			if (!source.includes("import.meta.url")) {
				throw new Error("libavoid node build: expected `import.meta.url` to shim — vendored shape changed");
			}
			let contents = source.replaceAll("import.meta.url", LIBAVOID_META_URL_SHIM);
			// The node build constructs the Emscripten module options as `{locateFile:<ident>}`.
			// `locateFile` is a real Emscripten option key (never minified), so this anchor is
			// stable; we forward the wasm bytes alongside it.
			const optionsPattern = /\{locateFile:([A-Za-z_$][\w$]*)\}/g;
			const injectionCount = (contents.match(optionsPattern) ?? []).length;
			if (injectionCount !== 1) {
				throw new Error(
					`libavoid node build: expected exactly ONE {locateFile:…} options object to inject wasmBinary into, found ${injectionCount} — vendored shape changed`,
				);
			}
			contents = contents.replace(optionsPattern, `{locateFile:$1,wasmBinary:${LIBAVOID_WASM_BINARY_GLOBAL}}`);
			return { contents, loader: "js" };
		});
	},
};

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === "production";

// The dev-vault plugin dir is derived from manifest.json's id (single source of
// truth — Obsidian requires the plugin folder name to match the manifest id).
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const DEV_VAULT_PLUGIN_DIR = path.join(".dev-vault", ".obsidian", "plugins", manifest.id);
const PLUGIN_ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

// React Flow ships its required CSS as a file, but esbuild bundles JS only. We
// therefore GENERATE the shipped styles.css = React Flow's base CSS + our
// authored rules. Regenerating from node_modules on every build means it can
// never drift from the installed @xyflow/react version (no vendored copy to go
// stale). `styles.css` is thus a build output; edit the src/view/*.css sources.
const REACT_FLOW_CSS = path.join("node_modules", "@xyflow", "react", "dist", "style.css");
// Explicit ordered list (not a glob): concatenation order is part of the output contract.
const AUTHORED_CSS_FILES = [
	path.join("src", "view", "graph-view.css"),
	path.join("src", "view", "node-outline.css"),
	path.join("src", "view", "settings-tab.css"),
	// Shared by BOTH surfaces above; all-new selectors, so appending last is safe.
	path.join("src", "view", "segmented-control.css"),
	// Link-preview modal; all-new selectors under its own prefix.
	path.join("src", "view", "link-preview.css"),
];

function generateStylesCss() {
	const header = `/* GENERATED by esbuild.config.mjs — do not edit. Sources: @xyflow/react/dist/style.css + ${AUTHORED_CSS_FILES.join(" + ")} */\n`;
	const reactFlowCss = fs.readFileSync(REACT_FLOW_CSS, "utf8");
	const authoredCss = AUTHORED_CSS_FILES.map((file) => fs.readFileSync(file, "utf8")).join("\n");
	fs.writeFileSync("styles.css", `${header}\n${reactFlowCss}\n${authoredCss}`);
}

/** Rebuilds styles.css before each (re)build so the copy step ships a fresh, in-sync file. */
const generateStylesPlugin = {
	name: "generate-styles",
	setup(build) {
		build.onStart(() => {
			generateStylesCss();
		});
	},
};

/** After every successful (re)build, place the plugin artifacts where the dev vault loads them. */
const copyToDevVaultPlugin = {
	name: "copy-to-dev-vault",
	setup(build) {
		build.onEnd((result) => {
			if (result.errors.length > 0) {
				return;
			}
			fs.mkdirSync(DEV_VAULT_PLUGIN_DIR, { recursive: true });
			for (const artifact of PLUGIN_ARTIFACTS) {
				fs.copyFileSync(artifact, path.join(DEV_VAULT_PLUGIN_DIR, artifact));
			}
			console.log(`copied plugin artifacts to ${DEV_VAULT_PLUGIN_DIR}`);
		});
	},
};

/**
 * The esbuild options that determine main.js CONTENT — the libavoid transforms are
 * baked in, but the file-writing plugins (styles generation, dev-vault copy) are NOT,
 * so the bundle can be produced in isolation. The token guard test
 * (src/view/libavoidTokenGuard.test.ts) reuses this to build the real bundle with
 * `write:false` and scan it, rather than reading a possibly-stale on-disk main.js.
 */
export function bundleContentOptions(prod) {
	return {
		banner: { js: banner },
		entryPoints: ["src/main.ts"],
		bundle: true,
		// `obsidian` (and friends) are provided by the Obsidian runtime — never bundled.
		// stable-ids-for-obsidian is deliberately NOT external: the published package is bundled into main.js.
		external: [
			"obsidian",
			"electron",
			"@codemirror/autocomplete",
			"@codemirror/collab",
			"@codemirror/commands",
			"@codemirror/language",
			"@codemirror/lint",
			"@codemirror/search",
			"@codemirror/state",
			"@codemirror/view",
			"@lezer/common",
			"@lezer/highlight",
			"@lezer/lr",
			...builtinModules,
		],
		format: "cjs",
		target: "es2021",
		logLevel: "info",
		sourcemap: prod ? false : "inline",
		treeShaking: true,
		outfile: "main.js",
		minify: prod,
		// `.wasm` → Uint8Array import (libavoid engine embedded, injected offline as `wasmBinary`).
		loader: { ".wasm": "binary" },
		plugins: [libavoidWasmPlugin, libavoidNodeBuildPlugin],
	};
}

// Run the build/watch only when this file is invoked directly (`node esbuild.config.mjs`),
// NOT when it is merely imported — the token guard test imports `bundleContentOptions`
// and must not trigger a real build or a file watcher.
const invokedDirectly = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
	const options = bundleContentOptions(prod);
	// The CLI build also GENERATES styles.css and copies artifacts into the dev vault;
	// those side-effect plugins wrap the content plugins baked into `options`.
	const context = await esbuild.context({
		...options,
		plugins: [generateStylesPlugin, ...options.plugins, copyToDevVaultPlugin],
	});
	if (prod) {
		await context.rebuild();
		await context.dispose();
	} else {
		await context.watch();
	}
}
