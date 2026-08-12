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
);
