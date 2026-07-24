import type { ElkNode } from "elkjs";
import type { ForceLayoutSettings } from "../engine";
import { EngineDefaults } from "../engine";
import { ELK_FORCE_ALGORITHM } from "./constants";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { refineForceRootLayout } from "./d3ForceRefinement";

const ELK_ALGORITHM_OPTION = "elk.algorithm";

/**
 * The view's layout engine (`GraphLayoutPort`): elk for everything, plus the
 * d3-force root refinement when the root runs the `force` algorithm — elk's
 * force pass there is only the seed ({@link ELK_FORCE_ALGORITHM}).
 * Composition keeps {@link ElkLayoutRunner} a pure elk wrapper.
 *
 * `forceLayout` defaults to the ENGINE defaults (the shipped ticket-03
 * constants) so headless/test callers get exactly the default rendered
 * behavior; the controller always passes the build's resolved
 * `viewSettings.forceLayout` (slider values).
 */
export class GraphLayoutRunner {
	private readonly elk = new ElkLayoutRunner();

	async layout(
		graph: ElkNode,
		forceLayout: ForceLayoutSettings = EngineDefaults.forceLayoutSettings(),
	): Promise<ElkNode> {
		const laidOut = await this.elk.layout(graph);
		const isForceRoot = graph.layoutOptions?.[ELK_ALGORITHM_OPTION] === ELK_FORCE_ALGORITHM;
		return isForceRoot ? refineForceRootLayout(laidOut, forceLayout) : laidOut;
	}
}
