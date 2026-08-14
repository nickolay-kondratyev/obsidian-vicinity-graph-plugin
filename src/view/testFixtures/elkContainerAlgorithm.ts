import type { ElkNode } from "elkjs";
import { isFolderGroupId } from "../graphIdentity";

/**
 * Merges `options` over every folder-group CONTAINER's `layoutOptions` (root
 * and leaves untouched) — the interior-layout candidate switch (ticket
 * nid_7abfje1vus15rx9hzmpel9jin_e), shared by the eval harness and the
 * box-refit tests so "run this graph with <these interior options>" is
 * expressed one way everywhere. Pass a production options function's result
 * (e.g. `elkGroupMemberForceOptions(...)`) to test the shippable
 * configuration; keys not overridden (like `elk.padding`) survive the merge.
 */
export function withContainerOptions(node: ElkNode, options: Readonly<Record<string, string>>): ElkNode {
	const children = node.children;
	if (children === undefined) {
		return node;
	}
	const rewritten = children.map((child) => withContainerOptions(child, options));
	if (!isFolderGroupId(node.id)) {
		return { ...node, children: rewritten };
	}
	return {
		...node,
		children: rewritten,
		layoutOptions: { ...node.layoutOptions, ...options },
	};
}
