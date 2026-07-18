import { describe, expect, it } from "vitest";
import { attachmentGroupLabel, attachmentIconId, FALLBACK_ATTACHMENT_ICON_ID } from "./attachmentIcons";

describe("attachmentIconId", () => {
	it("WHEN the extension is a known image type THEN it maps to the image icon", () => {
		expect(attachmentIconId("png")).toBe("file-image");
	});

	it("WHEN the extension is unknown THEN it falls back to the generic file icon", () => {
		expect(attachmentIconId("xyz")).toBe(FALLBACK_ATTACHMENT_ICON_ID);
	});

	it("WHEN the attachment has no extension THEN it falls back to the generic file icon", () => {
		expect(attachmentIconId("")).toBe(FALLBACK_ATTACHMENT_ICON_ID);
	});
});

describe("attachmentGroupLabel", () => {
	it("WHEN a group has several files THEN the label pluralizes", () => {
		expect(attachmentGroupLabel("png", 2)).toBe("2 png files");
	});

	it("WHEN a group has one file THEN the label is singular", () => {
		expect(attachmentGroupLabel("pdf", 1)).toBe("1 pdf file");
	});

	it("WHEN the group is extension-less THEN the label says so instead of showing an empty string", () => {
		expect(attachmentGroupLabel("", 1)).toBe("1 file (no extension)");
	});
});
