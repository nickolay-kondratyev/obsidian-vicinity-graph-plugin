import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { VaultPathFacts } from "../shared/VaultPathFacts";
import { LinkPreviewContent } from "./LinkPreviewContent";
import type { LinkPreviewGoTarget } from "./LinkPreviewContent";
import type { LinkPreviewModel } from "./linkPreviewModel";

/**
 * The in-graph link-preview drawer (ticket `nid_5j9mygfywppaiakuim3utf6r2_e`):
 * the retired `LinkPreviewModal`'s chrome, rebuilt as a slide-out panel INSIDE
 * the graph pane. Which edge it slides from is pure CSS (`link-preview.css`,
 * container query on the pane's aspect ratio) — this component only owns the
 * header, the close affordances and the close-on-GO contract; all list
 * behaviour stays in {@link LinkPreviewContent}.
 *
 * A non-modal dialog on purpose: the graph behind it stays interactive, and
 * clicking another node/edge simply retargets the drawer (store semantics).
 */

/** Lucide icon of the header close button. */
export const CLOSE_ICON_ID = "x";

export interface LinkPreviewDrawerProps {
	readonly model: LinkPreviewModel;
	/** The `GraphUiPort.renderIcon` seam — built-in (lucide) icon into `el`. */
	readonly renderIcon: (el: HTMLElement, iconId: string) => void;
	/** Dismiss the drawer (close button, Escape; the flow adds pane clicks). */
	readonly onClose: () => void;
	/** GO click. The drawer closes itself first — the editor takes over. */
	readonly onGo: (target: LinkPreviewGoTarget) => void;
}

export function LinkPreviewDrawer({ model, renderIcon, onClose, onGo }: LinkPreviewDrawerProps): ReactElement {
	// Escape must work without the drawer holding focus (the graph usually has
	// it), so listen on the window for the drawer's lifetime.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onClose]);
	const title = titleOf(model);
	return (
		<div className="vicinity-graph-link-preview-drawer" role="dialog" aria-label={title}>
			<header className="vicinity-graph-link-preview-drawer__header">
				<h2 className="vicinity-graph-link-preview-drawer__title" title={title}>
					{title}
				</h2>
				<CloseButton renderIcon={renderIcon} onClose={onClose} />
			</header>
			<div className="vicinity-graph-link-preview-drawer__body">
				<LinkPreviewContent
					model={model}
					renderIcon={renderIcon}
					onGo={(target) => {
						onClose();
						onGo(target);
					}}
				/>
			</div>
		</div>
	);
}

function CloseButton({
	renderIcon,
	onClose,
}: {
	readonly renderIcon: (el: HTMLElement, iconId: string) => void;
	readonly onClose: () => void;
}): ReactElement {
	const iconRef = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (iconRef.current !== null) {
			renderIcon(iconRef.current, CLOSE_ICON_ID);
		}
	}, [renderIcon]);
	return (
		<button
			type="button"
			className="vicinity-graph-link-preview-drawer__close"
			aria-label="Close preview"
			title="Close preview"
			onClick={onClose}
		>
			<span ref={iconRef} className="vicinity-graph-link-preview-drawer__close-icon" aria-hidden="true" />
		</button>
	);
}

/** Same title rule the modal had: note title, or `source → target` for an edge. */
function titleOf(model: LinkPreviewModel): string {
	return model.kind === "node"
		? VaultPathFacts.titleOf(model.path)
		: `${VaultPathFacts.titleOf(model.sourcePath)} → ${VaultPathFacts.titleOf(model.targetPath)}`;
}
