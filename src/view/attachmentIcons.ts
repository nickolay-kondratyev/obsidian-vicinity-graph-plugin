/**
 * Attachment extension → icon mapping for the node icon strip and the native
 * attachment menu (step-05). Icon ids are Obsidian's built-in lucide names,
 * rendered by the {@link GraphUiPort} adapter — this module stays pure so the
 * mapping (and its fallback) is node-tested.
 */

/** Fallback for unknown extensions AND extension-less attachments. */
export const FALLBACK_ATTACHMENT_ICON_ID = "file";

/** Strip label for attachments with no extension (review NIT-1). */
const NO_EXTENSION_LABEL = "no extension";

const ICON_ID_BY_EXTENSION: Readonly<Record<string, string>> = {
	png: "file-image",
	jpg: "file-image",
	jpeg: "file-image",
	gif: "file-image",
	webp: "file-image",
	svg: "file-image",
	avif: "file-image",
	bmp: "file-image",
	pdf: "file-text",
	txt: "file-text",
	csv: "file-spreadsheet",
	xls: "file-spreadsheet",
	xlsx: "file-spreadsheet",
	mp3: "file-audio",
	wav: "file-audio",
	ogg: "file-audio",
	flac: "file-audio",
	m4a: "file-audio",
	mp4: "file-video",
	mov: "file-video",
	mkv: "file-video",
	webm: "file-video",
	zip: "file-archive",
	gz: "file-archive",
	tar: "file-archive",
	rar: "file-archive",
	"7z": "file-archive",
};

/** Lucide icon id for a (lower-cased) attachment extension. */
export function attachmentIconId(extension: string): string {
	return ICON_ID_BY_EXTENSION[extension] ?? FALLBACK_ATTACHMENT_ICON_ID;
}

/**
 * Tooltip / aria-label for one icon-strip chip, e.g. "2 png files".
 * The extension-less group reads "1 file (no extension)".
 */
export function attachmentGroupLabel(extension: string, count: number): string {
	const noun = count === 1 ? "file" : "files";
	if (extension === "") {
		return `${count} ${noun} (${NO_EXTENSION_LABEL})`;
	}
	return `${count} ${extension} ${noun}`;
}
