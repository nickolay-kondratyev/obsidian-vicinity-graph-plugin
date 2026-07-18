import type { AttachmentRef } from "../engine";
import { VaultPathFacts } from "../shared/VaultPathFacts";

/**
 * Attachment → icon-strip derivation (step-05): one strip entry per attachment
 * extension, with count and the concrete files behind it (the dropdown's
 * entries). Pure and RF-free; the rendering component only iterates.
 */
export interface AttachmentIconGroup {
	/** Lower-cased extension without the dot; "" for extension-less files. */
	readonly extension: string;
	readonly count: number;
	/** The attachments of this extension, in first-reference order (dropdown entries). */
	readonly paths: readonly string[];
}

/** Groups attachments by extension, preserving first-seen extension order. */
export function attachmentIconStrip(attachments: readonly AttachmentRef[]): readonly AttachmentIconGroup[] {
	const pathsByExtension = new Map<string, string[]>();
	for (const attachment of attachments) {
		const extension = VaultPathFacts.extensionOf(attachment.path);
		const paths = pathsByExtension.get(extension) ?? [];
		paths.push(attachment.path);
		pathsByExtension.set(extension, paths);
	}
	return [...pathsByExtension.entries()].map(([extension, paths]) => ({
		extension,
		count: paths.length,
		paths,
	}));
}
