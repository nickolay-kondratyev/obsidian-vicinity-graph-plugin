import type { ElkNode } from "elkjs";
import { ELK_FORCE_ROOT_OPTIONS } from "./constants";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { refineForceRootLayout } from "./d3ForceRefinement";

const ELK_ALGORITHM_OPTION = "elk.algorithm";

/**
 * The view's layout engine (`GraphLayoutPort`): elk for everything, plus the
 * d3-force root refinement when the root runs the `force` algorithm — elk's
 * force pass there is only the seed ({@link ELK_FORCE_ROOT_OPTIONS}).
 * Composition keeps {@link ElkLayoutRunner} a pure elk wrapper.
 */
export class GraphLayoutRunner {
	private readonly elk = new ElkLayoutRunner();

	async layout(graph: ElkNode): Promise<ElkNode> {
		const laidOut = await this.elk.layout(graph);
		const isForceRoot =
			graph.layoutOptions?.[ELK_ALGORITHM_OPTION] === ELK_FORCE_ROOT_OPTIONS[ELK_ALGORITHM_OPTION];
		return isForceRoot ? refineForceRootLayout(laidOut) : laidOut;
	}
}
