import { describe, expect, it } from "vitest";
import { FakeLinkProvider } from "./FakeLinkProvider";
import { NodeEligibility } from "./NodeEligibility";
import { asVaultPath } from "./types";

const A = asVaultPath("a.md");
const B = asVaultPath("notes/b.md");
const IMG = asVaultPath("assets/pic.png");
const PDF = asVaultPath("assets/doc.pdf");

// GIVEN a small fixture vault: a.md → [doc.pdf, b.md, pic.png]
function vault(): FakeLinkProvider {
	return new FakeLinkProvider({
		files: [
			{ path: "a.md", sizeBytes: 10 },
			{ path: "notes/b.md" },
			{ path: "assets/pic.png" },
			{ path: "assets/doc.pdf" },
		],
		links: { "a.md": ["assets/doc.pdf", "notes/b.md", "assets/pic.png"] },
	});
}

describe("FakeLinkProvider outgoing/incoming links", () => {
	it("WHEN querying outgoing links THEN targets are returned in declared order", () => {
		expect(vault().getOutgoingLinks(A)).toEqual([PDF, B, IMG]);
	});

	it("WHEN querying incoming links of a target THEN the linker is derived by inversion", () => {
		expect(vault().getIncomingLinks(B)).toEqual([A]);
	});

	it("WHEN querying links of a file with none THEN an empty list is returned", () => {
		expect(vault().getOutgoingLinks(B)).toEqual([]);
	});

	it("WHEN a link names an undeclared file THEN construction fails loudly", () => {
		expect(
			() => new FakeLinkProvider({ files: [{ path: "a.md" }], links: { "a.md": ["ghost.md"] } }),
		).toThrowError(/ghost\.md/);
	});
});

describe("FakeLinkProvider metadata defaults", () => {
	it("WHEN a .md file is declared without flags THEN it is node-bearing", () => {
		expect(vault().getFileMetadata(B)?.isNodeBearing).toBe(true);
	});

	it("WHEN a .canvas file is declared THEN it is node-bearing", () => {
		const provider = new FakeLinkProvider({ files: [{ path: "board.canvas" }] });
		expect(provider.getFileMetadata(asVaultPath("board.canvas"))?.isNodeBearing).toBe(true);
	});

	it("WHEN a .png file is declared THEN it is NOT node-bearing", () => {
		expect(vault().getFileMetadata(IMG)?.isNodeBearing).toBe(false);
	});

	it("WHEN a file lives in a folder THEN metadata reports that folder", () => {
		expect(vault().getFileMetadata(B)?.folder).toBe("notes");
	});

	it("WHEN a file lives at the vault root THEN metadata reports the empty folder", () => {
		expect(vault().getFileMetadata(A)?.folder).toBe("");
	});

	it("WHEN an unknown path is queried THEN metadata is undefined", () => {
		expect(vault().getFileMetadata(asVaultPath("nope.md"))).toBeUndefined();
	});
});

describe("FakeLinkProvider attachment derivation", () => {
	it("WHEN a note links non-node-bearing files THEN they become its attachments in link order", () => {
		expect(vault().getFileMetadata(A)?.attachments.map((a) => a.path)).toEqual([PDF, IMG]);
	});

	it("WHEN an attachment has an image extension THEN it is flagged as an image", () => {
		expect(vault().getFileMetadata(A)?.attachments.map((a) => a.isImage)).toEqual([false, true]);
	});
});

describe("FakeLinkProvider duplicate links (multiplicity, step-05)", () => {
	// GIVEN a note that links b.md twice and pic.png once.
	function duplicateVault(): FakeLinkProvider {
		return new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "notes/b.md" }, { path: "assets/pic.png" }],
			links: { "a.md": ["notes/b.md", "assets/pic.png", "notes/b.md"] },
		});
	}

	it("WHEN a target is linked twice THEN getLinkCount reports 2", () => {
		expect(duplicateVault().getLinkCount(A, B)).toBe(2);
	});

	it("WHEN a pair has no link THEN getLinkCount reports 0", () => {
		expect(duplicateVault().getLinkCount(B, A)).toBe(0);
	});

	it("WHEN a target is linked twice THEN outgoing links are deduplicated (adapter parity)", () => {
		expect(duplicateVault().getOutgoingLinks(A)).toEqual([B, IMG]);
	});

	it("WHEN a linker links twice THEN incoming links are deduplicated (adapter parity)", () => {
		expect(duplicateVault().getIncomingLinks(B)).toEqual([A]);
	});

	it("WHEN an attachment is linked twice THEN it appears once among attachments (adapter parity)", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md" }, { path: "assets/pic.png" }],
			links: { "a.md": ["assets/pic.png", "assets/pic.png"] },
		});
		expect(provider.getFileMetadata(A)?.attachments.map((a) => a.path)).toEqual([IMG]);
	});
});

describe("NodeEligibility (SRP owner of the node-bearing flag)", () => {
	it("WHEN the provider marks a path node-bearing THEN it is eligible", () => {
		expect(new NodeEligibility(vault()).isNodeBearing(A)).toBe(true);
	});

	it("WHEN the provider marks a path non-node-bearing THEN it is not eligible", () => {
		expect(new NodeEligibility(vault()).isNodeBearing(IMG)).toBe(false);
	});

	it("WHEN a path is unknown to the provider THEN it is not eligible", () => {
		expect(new NodeEligibility(vault()).isNodeBearing(asVaultPath("ghost.md"))).toBe(false);
	});
});

describe("FakeLinkProvider note outline", () => {
	it("WHEN a fixture file declares an outline THEN the metadata returns it", () => {
		const provider = new FakeLinkProvider({
			files: [{ path: "a.md", outline: [{ rawText: "Intro", level: 1 }] }],
		});
		expect(provider.getFileMetadata(A)?.outline).toEqual([{ rawText: "Intro", level: 1 }]);
	});

	it("WHEN a fixture file declares no outline THEN the metadata carries an empty array (never undefined)", () => {
		expect(vault().getFileMetadata(A)?.outline).toEqual([]);
	});
});
