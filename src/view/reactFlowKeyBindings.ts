import type { ReactFlowProps } from "@xyflow/react";

/**
 * EVERY React Flow key binding, nulled — the ONE place the graph's keyboard
 * surface is declared. RF listens for its key bindings on the WHOLE
 * window/document and preventDefault()s matches for as long as the view is
 * mounted; its input-field exemption does not cover keystrokes Obsidian
 * forwards from controlled iframes (canvas cards), so the default Space
 * binding ate Space in canvas text nodes app-wide (ticket
 * nid_156zg4bvhjc7nnl0gwut20bvs_e; gated by e2e/canvasSpaceKey.e2e.ts).
 *
 * The graph is read-only and needs none of them: nothing to delete, no
 * marquee selection, pan/zoom work by pointer alone — and ctrl/cmd is the
 * "open in new tab" gesture (CLARIFICATION Q2), which RF's default
 * multi-select modifier would double-book with a meaningless persistent
 * selection.
 *
 * `reactFlowKeyBindings.component.test.tsx` mounts the REAL `<ReactFlow>`
 * with this object and asserts zero window/document key listeners, so an RF
 * upgrade that grows a NEW default binding fails there — extend this object,
 * don't hand a listener back to RF silently. `reactFlowKeyBindingsUsage.test.ts`
 * guards the other half: no view module may name a `*KeyCode` prop outside
 * this file, so the spread cannot be overridden at the call site.
 */
export const REACT_FLOW_GLOBAL_KEY_BINDINGS = {
	deleteKeyCode: null,
	selectionKeyCode: null,
	multiSelectionKeyCode: null,
	panActivationKeyCode: null,
	zoomActivationKeyCode: null,
} satisfies Partial<ReactFlowProps>;
