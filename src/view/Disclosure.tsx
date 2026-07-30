import type { ReactElement, ReactNode } from "react";

/**
 * Shared collapsible section for the graph-controls panel: a native
 * `<details>` styled with the existing `vicinity-graph-disclosure` classes
 * (chevron summary, primary-background card). Extracted once the panel grew to
 * five copies of the same markup (DRY).
 *
 * Open/closed is DOM-only state (no persisted setting, no React state — the
 * toolbar-wide rule). `defaultOpen` only affects the FIRST render: the prop
 * value never changes afterwards, so React never rewrites the DOM `open`
 * property and the user's toggling survives every snapshot re-render.
 */
export function Disclosure({
	summary,
	summaryTitle,
	defaultOpen = false,
	className,
	bodyClassName,
	children,
}: {
	readonly summary: ReactNode;
	/**
	 * Native hover tooltip on the `<summary>`. The 260px panel has no room for a
	 * section's description text, so the shared copy rides here instead of being
	 * dropped (same string as the settings tab's description row — zero drift).
	 */
	readonly summaryTitle?: string;
	readonly defaultOpen?: boolean;
	/** Extra class(es) on the `<details>` root (e.g. a section-specific block class). */
	readonly className?: string;
	/** Extra class(es) on the body div (e.g. React Flow's `nowheel` escape hatch). */
	readonly bodyClassName?: string;
	readonly children: ReactNode;
}): ReactElement {
	const rootClass = className === undefined ? "vicinity-graph-disclosure" : `vicinity-graph-disclosure ${className}`;
	const bodyClass =
		bodyClassName === undefined ? "vicinity-graph-disclosure__body" : `vicinity-graph-disclosure__body ${bodyClassName}`;
	return (
		<details className={rootClass} open={defaultOpen || undefined}>
			<summary className="vicinity-graph-disclosure__summary" title={summaryTitle}>
				{summary}
			</summary>
			<div className={bodyClass}>{children}</div>
		</details>
	);
}
