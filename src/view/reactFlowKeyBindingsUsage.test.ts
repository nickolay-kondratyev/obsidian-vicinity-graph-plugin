import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readRowSourceWithoutComments } from "./rowRenderingSource";

/**
 * The USAGE half of the key-binding guard. `reactFlowKeyBindings.component.test.tsx`
 * proves the CONSTANT silences every React Flow key listener — but it mounts a bare
 * `<ReactFlow>` with that object, not `VicinityGraphFlow`, so on its own it says
 * nothing about the production JSX: a `deleteKeyCode="Backspace"` added AFTER the
 * spread would win the prop merge and re-arm RF's window-wide key grab (the ticket
 * nid_156zg4bvhjc7nnl0gwut20bvs_e bug, back) while every jsdom suite stayed green
 * and only the Space-shaped e2e could notice.
 *
 * WHY a source scan (same reasoning as `typedNumberFields.test.ts`): "no view module
 * hands React Flow a key binding except through the ONE constant" is a claim about
 * the SOURCE, over files a rendered suite never mounts.
 */

const VIEW_DIR = dirname(fileURLToPath(import.meta.url));

/** The one module allowed to name RF key-binding props: the constant's own file. */
const KEY_BINDINGS_MODULE = "reactFlowKeyBindings.ts";

/**
 * Matches any React Flow key-binding prop (`deleteKeyCode`, `panActivationKeyCode`,
 * …) by its `…KeyCode` suffix — future RF bindings included — while a bare DOM
 * `event.keyCode` (lowercase k) stays unmatched.
 */
const RF_KEY_BINDING_PROP = /[a-zA-Z]+KeyCode\b/;

/** Every non-test view module the rule must hold over (top-level `.ts`/`.tsx` only). */
function everyScannedViewModule(): readonly string[] {
	return readdirSync(VIEW_DIR)
		.filter((name) => /\.tsx?$/.test(name))
		.filter((name) => !/\.test\.tsx?$/.test(name));
}

describe("React Flow key bindings reach the graph only through REACT_FLOW_GLOBAL_KEY_BINDINGS", () => {
	it("WHEN scanning every view module THEN only reactFlowKeyBindings.ts names a React Flow *KeyCode prop", () => {
		const offenders = everyScannedViewModule()
			.filter((module) => module !== KEY_BINDINGS_MODULE)
			.filter((module) => RF_KEY_BINDING_PROP.test(readRowSourceWithoutComments(module)));
		// A hit here is a key binding handed to React Flow OUTSIDE the one constant —
		// it can override the spread and steal keystrokes from ALL of Obsidian.
		// Route it through REACT_FLOW_GLOBAL_KEY_BINDINGS instead.
		expect(offenders).toEqual([]);
	});

	it("WHEN reading VicinityGraphFlow THEN <ReactFlow> spreads REACT_FLOW_GLOBAL_KEY_BINDINGS", () => {
		const source = readRowSourceWithoutComments("VicinityGraphFlow.tsx");
		expect(source).toContain("{...REACT_FLOW_GLOBAL_KEY_BINDINGS}");
	});
});
