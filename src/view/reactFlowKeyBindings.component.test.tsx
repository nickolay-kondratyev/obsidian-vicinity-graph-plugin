// @vitest-environment jsdom
import { ReactFlow } from "@xyflow/react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REACT_FLOW_GLOBAL_KEY_BINDINGS } from "./reactFlowKeyBindings";

/**
 * The upgrade tripwire for ticket nid_156zg4bvhjc7nnl0gwut20bvs_e: React Flow
 * key bindings register `preventDefault()`ing key listeners on the WHOLE
 * window/document, which ate Space in Obsidian's canvas cards app-wide.
 * `REACT_FLOW_GLOBAL_KEY_BINDINGS` nulls every binding the CURRENT React Flow
 * ships — but a future upgrade can add a NEW default binding our null-list
 * does not name, and no compile error would say so.
 *
 * So this suite measures the effect, not the prop list: it mounts the REAL
 * `<ReactFlow>` and records every key listener registered on window/document
 * during mount. The control case (RF defaults DO register key listeners) is
 * load-bearing — it proves the recorder still sees RF's registration
 * mechanism, so the zero-listener assertion cannot rot into a test that
 * passes because it stopped observing anything.
 *
 * jsdom is enough: registration happens in mount effects, no layout needed.
 * (`e2e/canvasSpaceKey.e2e.ts` keeps the real-Obsidian proof for the Space
 * path; this suite is the cheap, every-`npm test` early warning.)
 */

/** RF's Wrapper observes its container; jsdom has no ResizeObserver. */
class ResizeObserverStub {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

const KEY_EVENT_TYPES = new Set(["keydown", "keyup", "keypress"]);

/**
 * Mounts `element` while window.addEventListener and document.addEventListener
 * are wrapped, and returns the KEY event types registered during mount.
 * Wrapping (not replacing) keeps every listener working; restoration is in
 * `finally` so one failing render cannot leak the wrap into other tests.
 */
function keyListenersRegisteredDuringMount(element: React.ReactElement): string[] {
	const registered: string[] = [];
	const targets: (Window | Document)[] = [window, document];
	const originals = targets.map((target) => target.addEventListener.bind(target));
	try {
		targets.forEach((target, index) => {
			target.addEventListener = ((type: string, ...rest: unknown[]) => {
				if (KEY_EVENT_TYPES.has(type)) {
					registered.push(type);
				}
				(originals[index] as (...args: unknown[]) => void)(type, ...rest);
			}) as typeof target.addEventListener;
		});
		render(element);
	} finally {
		targets.forEach((target, index) => {
			target.addEventListener = originals[index] as typeof target.addEventListener;
		});
	}
	return registered;
}

afterEach(() => {
	cleanup();
});

describe("React Flow global key listeners", () => {
	it("WHEN React Flow mounts with ITS OWN defaults THEN it registers window/document key listeners (recorder control)", () => {
		const registered = keyListenersRegisteredDuringMount(<ReactFlow nodes={[]} edges={[]} />);
		expect(registered.length).toBeGreaterThan(0);
	});

	it("WHEN React Flow mounts with REACT_FLOW_GLOBAL_KEY_BINDINGS THEN it registers NO window/document key listener", () => {
		const registered = keyListenersRegisteredDuringMount(
			<ReactFlow nodes={[]} edges={[]} {...REACT_FLOW_GLOBAL_KEY_BINDINGS} />,
		);
		// Non-empty here means the installed React Flow grew a key binding that
		// src/view/reactFlowKeyBindings.ts does not null out — extend that
		// object (it can steal keystrokes from ALL of Obsidian otherwise).
		expect(registered).toEqual([]);
	});
});
