// @vitest-environment jsdom
import { Position, ReactFlow } from "@xyflow/react";
import type { Edge, EdgeTypes, Node } from "@xyflow/react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EdgeRelationship } from "../engine";
import { EdgeRelationshipContext } from "./EdgeRelationshipContext";
import { EdgeRelationshipOverlayStore } from "./EdgeRelationshipOverlayStore";
import { VicinityEdge } from "./VicinityEdge";
import type { VicinityEdgeData } from "./VicinityEdge";

/**
 * Rendered proof of the edge's relationship LABEL (ticket
 * `nid_gk9h4jpa7di1al7och0rehd3h_e`): a REAL `<ReactFlow>` mounts the real
 * `VicinityEdge`, reading names from the real overlay store through its context —
 * the same path `VicinityGraphFlow` wires. Which name an edge gets is pure logic
 * (`EdgeRelationships.test.ts`); this pins that the edge SHOWS it.
 *
 * jsdom needs the same ResizeObserver stub as `NoteNode.component.test.tsx`.
 */

class ResizeObserverStub {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}
(window as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

const EDGE_TYPES: EdgeTypes = { vicinity: VicinityEdge };
const RELATIONSHIP_KEY = "a.md\u0000b.md";
const IMPROVES: EdgeRelationship = { name: "improves", origin: "syntax" };

/**
 * Two nodes with explicit size AND handles — React Flow's server-side-rendering
 * inputs, which let it draw an edge without measuring the DOM (jsdom has no layout).
 */
const NODES: Node[] = [
	{
		id: "a.md",
		position: { x: 0, y: 0 },
		width: 100,
		height: 40,
		handles: [{ type: "source", position: Position.Right, x: 100, y: 20, width: 1, height: 1 }],
		data: {},
	},
	{
		id: "b.md",
		position: { x: 300, y: 0 },
		width: 100,
		height: 40,
		handles: [{ type: "target", position: Position.Left, x: 0, y: 20, width: 1, height: 1 }],
		data: {},
	},
];

function edgeWith(data: Partial<VicinityEdgeData>): Edge {
	const full: VicinityEdgeData = {
		count: 1,
		hasOpposite: false,
		bidirectional: false,
		relationshipKey: RELATIONSHIP_KEY,
		...data,
	};
	return { id: "a.md->b.md", source: "a.md", target: "b.md", type: "vicinity", data: full };
}

function renderEdge(edge: Edge, store: EdgeRelationshipOverlayStore): HTMLElement {
	const { container } = render(
		<EdgeRelationshipContext.Provider value={store}>
			<div style={{ width: 800, height: 600 }}>
				<ReactFlow nodes={NODES} edges={[edge]} edgeTypes={EDGE_TYPES} />
			</div>
		</EdgeRelationshipContext.Provider>,
	);
	return container;
}

function storeWith(relationships: ReadonlyMap<string, EdgeRelationship>): EdgeRelationshipOverlayStore {
	const store = new EdgeRelationshipOverlayStore();
	store.showEdgeRelationships(relationships);
	return store;
}

/** The rendered relationship name, once React Flow has drawn the edge (null when it has none). */
async function relationshipText(container: HTMLElement): Promise<string | null> {
	await waitFor(() => expect(container.querySelector(".react-flow__edge")).not.toBeNull());
	return container.querySelector(".vicinity-graph-edge__relationship")?.textContent ?? null;
}

afterEach(() => {
	cleanup();
});

describe("VicinityEdge relationship label", () => {
	it("WHEN the edge's pair is named THEN the edge shows the name", async () => {
		const container = renderEdge(edgeWith({}), storeWith(new Map([[RELATIONSHIP_KEY, IMPROVES]])));
		expect(await relationshipText(container)).toBe("improves");
	});

	it("WHEN the edge's pair is unnamed THEN the edge shows no name", async () => {
		const container = renderEdge(edgeWith({}), storeWith(new Map()));
		expect(await relationshipText(container)).toBeNull();
	});

	it("WHEN the edge is collapsed (no relationship key) THEN it shows no name", async () => {
		const container = renderEdge(edgeWith({ relationshipKey: null }), storeWith(new Map([[RELATIONSHIP_KEY, IMPROVES]])));
		expect(await relationshipText(container)).toBeNull();
	});

	it("WHEN the name arrives after the edge rendered THEN the edge shows it", async () => {
		const store = storeWith(new Map());
		const container = renderEdge(edgeWith({}), store);
		await relationshipText(container);
		act(() => store.showEdgeRelationships(new Map([[RELATIONSHIP_KEY, IMPROVES]])));
		expect(await relationshipText(container)).toBe("improves");
	});

	it("WHEN the named edge also has a count badge THEN both render in the one label", async () => {
		const container = renderEdge(edgeWith({ count: 2 }), storeWith(new Map([[RELATIONSHIP_KEY, IMPROVES]])));
		await relationshipText(container);
		expect(container.querySelectorAll(".vicinity-graph-edge__label > *")).toHaveLength(2);
	});
});
