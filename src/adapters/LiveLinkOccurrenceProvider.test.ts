import { describe, expect, it } from "vitest";
import { asVaultPath } from "../engine";
import { CanvasParseCache } from "./CanvasParseCache";
import { FakeObsidianPorts } from "./FakeObsidianPorts";
import type { FakeObsidianSpec } from "./FakeObsidianPorts";
import { FolderNoteIndex } from "./FolderNoteIndex";
import { FrontmatterIdIndex } from "./FrontmatterIdIndex";
import { LiveLinkOccurrenceProvider } from "./LiveLinkOccurrenceProvider";
import { NamedRelationshipsIndex } from "./NamedRelationshipsIndex";

const NOTE = asVaultPath("note.md");
const TARGET = asVaultPath("target.md");

// GIVEN a note whose body links [[Target]] once, at a known offset.
const NOTE_TEXT = "links [[Target]] here";
const TARGET_OFFSET = NOTE_TEXT.indexOf("[[Target]]");

const SPEC: FakeObsidianSpec = {
	files: [{ path: "note.md", content: NOTE_TEXT }, { path: "target.md" }],
	fileCaches: {
		"note.md": { links: [{ link: "Target", position: { start: { offset: TARGET_OFFSET } } }] },
	},
	resolutions: { Target: "target.md" },
	resolvedLinks: { "note.md": { "target.md": 1 } },
};

/**
 * Thin-glue coverage only: occurrence CORRECTNESS lives in
 * `ObsidianLinkOccurrenceProvider.test.ts`; this proves the per-query snapshot
 * wrapper actually reaches it.
 */
describe("LiveLinkOccurrenceProvider delegation", () => {
	function provider(): LiveLinkOccurrenceProvider {
		const ports = new FakeObsidianPorts(SPEC);
		const idIndex = new FrontmatterIdIndex(ports.vault, ports.metadataCache, () => "");
		return new LiveLinkOccurrenceProvider(
			ports.vault,
			ports.metadataCache,
			new CanvasParseCache(),
			idIndex,
			new FolderNoteIndex(ports.vault),
			new NamedRelationshipsIndex(ports.vault, ports.metadataCache),
		);
	}

	it("WHEN edge-scoped occurrences are queried THEN the snapshot provider's answer comes back", async () => {
		const occurrences = await provider().occurrencesBetween(NOTE, TARGET);
		expect(occurrences.map((occurrence) => occurrence.offset)).toEqual([TARGET_OFFSET]);
	});
});
