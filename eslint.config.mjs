// ESLint 9 flat config — adopts the Obsidian sample-template stack:
// `eslint-plugin-obsidianmd` recommended (which layers in
// `typescript-eslint`'s type-checked rules), wired with a type-aware parser so
// rules like `@typescript-eslint/no-unsafe-member-access` actually run.
//
// WHY type-aware: no-unsafe-* are type-checked rules; they only fire when the
// parser is given a TS program. `projectService: true` auto-discovers BOTH the
// root `tsconfig.json` (src/) and `e2e/tsconfig.json` (e2e/), so a single lint
// pass covers src/ AND e2e/ without hand-listing every tsconfig.
//
// Config lives at repo root (NOT inside src/engine) per the layering guards.
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		// Build artifacts and non-source configs are out of scope: they are not
		// in any tsconfig `include`, so type-aware parsing has no program for
		// them. The reproducible surface is src/ and e2e/ (the files named in the
		// per-group fix tickets).
		ignores: [
			"main.js",
			"styles.css",
			"esbuild.config.mjs",
			"vitest.config.ts",
			"node_modules/",
			".dev-vault/",
			"coverage/",
			".tmp/",
			".out/",
		],
	},
	...obsidianmd.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		// `obsidianmd/settings-tab/prefer-setting-definitions` prefers a declarative
		// `getSettingDefinitions()`. We intentionally keep the hand-built `Setting`
		// rows in this ONE file: it is one of TWO presenters over a single declared
		// row model (`src/view/settingsRows.ts`, `SETTINGS_GROUPS`), the other being
		// the in-graph React panel, held in lockstep by the parity guards (CLAUDE.md
		// "Settings rows"). The setting-definition API has no counterpart on the panel
		// side, so adopting it would fork the model and defeat that parity. Scoped OFF
		// here — NOT via an inline directive, which the obsidianmd recommended config
		// forbids for `obsidianmd/*` rules (`eslint-comments/no-restricted-disable`).
		// Owner decision, ticket nid_zs2aog8b2i9e3wutsorjm88ft_e. Revisit if the panel
		// is retired or the API gains a shared surface. See the class doc comment.
		files: ["src/view/VicinityGraphSettingTab.ts"],
		rules: {
			"obsidianmd/settings-tab/prefer-setting-definitions": "off",
		},
	},
	{
		// `obsidianmd/no-global-this` pushes `globalThis` → `window`/`activeWindow` for
		// popout compatibility. The libavoid WASM loader must do the OPPOSITE: it publishes
		// the embedded wasm bytes on `globalThis.__VICINITY_LIBAVOID_WASM_BINARY__`, the
		// EXACT token esbuild's node-build plugin injects as the Emscripten `wasmBinary`
		// source (esbuild.config.mjs, LIBAVOID_WASM_BINARY_GLOBAL). Publish and read must
		// share one object; the singleton load is cross-window and in a popout
		// `activeWindow !== globalThis`, so a window scope would strand the bytes. Scoped OFF
		// for this ONE file (NOT an inline directive, which obsidianmd recommended forbids via
		// `eslint-comments/no-restricted-disable`). Ticket nid_l17hhil9b22jas1lwvyfgxp5w_e.
		// See the WHY comment in initAvoid().
		files: ["src/view/libavoidLoader.ts"],
		rules: {
			"obsidianmd/no-global-this": "off",
		},
	},
	{
		// Warnings rollout (ticket nid_nioldkusdrwc7fqzr4bmq2bow_e, parent
		// nid_qjuqgqfwentq2l59o5ya17vra_e). The obsidianmd/* findings in src/ were
		// fixed under the per-group tickets; obsidianmd's own rules already emit at
		// `warn`. What remains are ACCEPTED typescript-eslint / core findings, all in
		// colocated `*.test.ts(x)` files (mock plumbing, deliberate precision-loss
		// fixtures, dynamic-import test helpers). We are NOT fixing those under this
		// chore; instead we run lint as WARNINGS so `npx eslint src` is green-able and
		// can be folded into `npm run check` (hence `npm run build`) — new instances
		// of these rules surface as warnings without hard-failing day-to-day work.
		// Each accepted rule is listed explicitly (POLS): a genuinely NEW error class
		// still fails the gate, which is the non-regression signal we want. Revisit to
		// re-tighten any of these to `error` once its sites are cleaned up.
		files: ["src/**/*.{ts,tsx}"],
		rules: {
			"@typescript-eslint/unbound-method": "warn",
			"@typescript-eslint/no-unsafe-assignment": "warn",
			"@typescript-eslint/no-unsafe-call": "warn",
			"@typescript-eslint/no-unsafe-member-access": "warn",
			"@typescript-eslint/no-unnecessary-type-assertion": "warn",
			"no-loss-of-precision": "warn",
			"no-unsanitized/method": "warn",
			"no-useless-escape": "warn",
		},
	},
);
