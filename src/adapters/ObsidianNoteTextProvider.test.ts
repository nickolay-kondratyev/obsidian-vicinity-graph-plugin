import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import type { VaultFilePort, VaultPort } from "./obsidianPorts";
import { ObsidianNoteTextProvider } from "./ObsidianNoteTextProvider";

function fileAt(path: string): VaultFilePort {
	return { path, extension: path.split(".").pop() ?? "", stat: { mtime: 0, size: 0 }, parent: { path: "/" } };
}

const CANVAS_JSON = JSON.stringify({
	nodes: [
		{ id: "1", type: "text", text: "First card" },
		{ id: "2", type: "file", file: "a.md" },
		{ id: "3", type: "text", text: "Second card" },
	],
});

function vaultOf(contents: Readonly<Record<string, string>>, failingReads: readonly string[] = []): VaultPort {
	return {
		getFileByPath: (path) => (path in contents ? fileAt(path) : null),
		getFiles: () => Object.keys(contents).map(fileAt),
		cachedRead: (file) =>
			failingReads.includes(file.path) ? Promise.reject(new Error("gone")) : Promise.resolve(contents[file.path] ?? ""),
	};
}

const VAULT = vaultOf({ "note.md": "---\nid: x\n---\nBody [[b]]", "board.canvas": CANVAS_JSON, "photo.png": "binary" });

describe("ObsidianNoteTextProvider", () => {
	it("WHEN a markdown note is read THEN its full raw content comes back", async () => {
		expect(await new ObsidianNoteTextProvider(VAULT).noteTextOf(asVaultPath("note.md"))).toBe("---\nid: x\n---\nBody [[b]]");
	});

	it("WHEN a canvas is read THEN its text cards come back, separated by a blank line", async () => {
		expect(await new ObsidianNoteTextProvider(VAULT).noteTextOf(asVaultPath("board.canvas"))).toBe("First card\n\nSecond card");
	});

	it("WHEN the path is an attachment THEN there is no text", async () => {
		expect(await new ObsidianNoteTextProvider(VAULT).noteTextOf(asVaultPath("photo.png"))).toBeNull();
	});

	it("WHEN no file is at the path THEN there is no text", async () => {
		expect(await new ObsidianNoteTextProvider(VAULT).noteTextOf(asVaultPath("gone.md"))).toBeNull();
	});

	it("WHEN the read fails THEN there is no text (the port never rejects)", async () => {
		const vault = vaultOf({ "note.md": "x" }, ["note.md"]);
		expect(await new ObsidianNoteTextProvider(vault).noteTextOf(asVaultPath("note.md"))).toBeNull();
	});
});
