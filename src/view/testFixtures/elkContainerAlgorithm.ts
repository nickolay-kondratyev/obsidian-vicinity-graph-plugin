import type { ElkNode } from "elkjs";
import { isFolderGroupId } from "../graphIdentity";

/**
 * Rewrites every folder-group CONTAINER's interior `elk.algorithm` (root and
 * leaves untouched) — the interior-layout evaluation's candidate switch
 * (ticket nid_7abfje1vus15rx9hzmpel9jin_e), shared by the eval harness and the
 * box-refit tests so "run this graph with <algorithm> interiors" is expressed
 * one way everywhere. `extraOptions` ride along for candidates that need their
 * own dials (e.g. stress's desired edge length).
 */
export function withContainerAlgorithm(
	node: ElkNode,
	algorithm: string,
	extraOptions: Readonly<Record<string, string>> = {},
): ElkNode {
	const children = node.children;
	if (children === undefined) {
		return node;
	}
	const rewritten = children.map((child) => withContainerAlgorithm(child, algorithm, extraOptions));
	if (!isFolderGroupId(node.id)) {
		return { ...node, children: rewritten };
	}
	return {
		...node,
		children: rewritten,
		layoutOptions: { ...node.layoutOptions, "elk.algorithm": algorithm, ...extraOptions },
	};
}
