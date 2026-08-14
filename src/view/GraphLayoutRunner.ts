import type { ElkNode } from "elkjs";
import type { ForceLayoutSettings } from "../engine";
import { EngineDefaults } from "../engine";
import { ELK_FORCE_ALGORITHM } from "./constants";
import { ElkLayoutRunner } from "./ElkLayoutRunner";
import { refitContainerBox } from "./containerBoxRefit";
import { refineForceRootLayout } from "./d3ForceRefinement";

const ELK_ALGORITHM_OPTION = "elk.algorithm";

/**
 * The view's layout engine (`GraphLayoutPort`): elk for everything, plus the
 * d3-force refinement of ANY container (root or folder group) whose elk
 * algorithm is `force` — elk's force pass there is only the seed
 * ({@link ELK_FORCE_ALGORITHM}). Composition keeps {@link ElkLayoutRunner} a
 * pure elk wrapper.
 *
 * The refinement recurses into every container: after elk lays the whole tree
 * out, each container carries its children AND its intra-group edges (per the
 * elk contract, attached in `elkMapping.ts`), so {@link refineForceRootLayout}
 * — already generic over any {@link ElkNode} — can refine a group interior the
 * same way it refines the root. The decision is PER CONTAINER, keyed on that
 * container's own algorithm marker (mirroring the root check); WHICH interior
 * folder containers carry is `GROUP_INTERIOR_LAYOUT` (`constants.ts`). Under
 * the shipped `rectpacking` pick only the root is `force`, so no interior is
 * refined and the output is byte-identical to the pre-recursion runner
 * (guarded in `GraphLayoutRunner.test.ts`); under `force`, every container's
 * interior is refined and its box refit (see `refineContainers`).
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
		return this.refineContainers(await this.elk.layout(graph), forceLayout, true);
	}

	/**
	 * Bottom-up walk: refine each child container first (its interior settles
	 * before its parent places it as a fixed-size box), then, iff THIS container
	 * runs `force`, refine its direct children. A leaf (no `children`) is
	 * returned untouched.
	 *
	 * A refined NON-ROOT container is then box-REFIT ({@link refitContainerBox}):
	 * the refinement moved its children, so its elk-computed box is stale — the
	 * refit re-wraps it before the parent (visited after, this being bottom-up)
	 * arranges it as a fixed-size box. The root is exempt: no rendered border,
	 * and its origin-centred coordinates feed the viewport fit directly.
	 * Rectpacking containers keep elk's box untouched, preserving the byte-exact
	 * default-path guarantee (guarded in `GraphLayoutRunner.test.ts`).
	 */
	private refineContainers(node: ElkNode, forceLayout: ForceLayoutSettings, isRoot: boolean): ElkNode {
		const children = node.children;
		if (children === undefined) {
			return node;
		}
		const withRefinedChildren: ElkNode = {
			...node,
			children: children.map((child) => this.refineContainers(child, forceLayout, false)),
		};
		const isForce = node.layoutOptions?.[ELK_ALGORITHM_OPTION] === ELK_FORCE_ALGORITHM;
		if (!isForce) {
			return withRefinedChildren;
		}
		const refined = refineForceRootLayout(withRefinedChildren, forceLayout);
		return isRoot ? refined : refitContainerBox(refined);
	}
}
