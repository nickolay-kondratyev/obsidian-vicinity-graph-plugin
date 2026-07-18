import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs";

/**
 * Thin wrapper over elkjs. Uses the self-contained bundled build
 * (`elk.bundled.js`), which runs the layout in-thread — matching the V1
 * "inline async, no web worker" decision (CLARIFICATION Q3) and letting the
 * layout run headless under Node for tests. Imports elkjs but neither obsidian
 * nor React, so it stays node-testable.
 */
export class ElkLayoutRunner {
	private readonly elk = new ELK();

	layout(graph: ElkNode): Promise<ElkNode> {
		return this.elk.layout(graph);
	}
}
