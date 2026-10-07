import { describe, expect, it } from "vitest";
import {
	asVaultPath,
	directedLinkKey,
	EngineDefaults,
	FakeNoteTextProvider,
	FakeRelationshipNamer,
	MIN_AI_CONTENT_CHARS,
} from "../engine";
import type {
	AiNamedRelationship,
	NoteTextProvider,
	RelationshipEdge,
	RelationshipName,
	RelationshipNamingOutcome,
	RelationshipSettings,
	StoredRelationship,
	VaultPath,
} from "../engine";
import { AiAutoNamingGate } from "./AiAutoNamingGate";
import { AI_MAX_REQUESTS_PER_BUILD, AiRelationshipQueue } from "./AiRelationshipQueue";
import type { AiRelationshipWriterPort, AutoNamingOffer, BuildTrigger } from "./viewPorts";

/**
 * Which builds start AI work (task 4/4 `nid_80xc6z8umlpo1x6u4p1v7eb22_e`), over the
 * REAL queue with a fake namer — so "nothing is asked" is a count of requests, not a
 * claim about a call into a mock.
 */

const PROSE = "p".repeat(MIN_AI_CONTENT_CHARS);
const MAIN = asVaultPath("main.md");
const NAMED: RelationshipNamingOutcome = {
	kind: "named",
	name: "extends" as RelationshipName,
	usage: { inputTokens: 10, outputTokens: 1 },
};
const NO_KEY: RelationshipNamingOutcome = { kind: "failed", failure: "no-key" };
const ON: RelationshipSettings = { ...EngineDefaults.relationshipSettings(), autoNaming: true };
const OFF: RelationshipSettings = { ...ON, autoNaming: false };

function target(index: number): VaultPath {
	return asVaultPath(`t-${index}.md`);
}

/** `main → t-i` link edges for i in [from, from + count). */
function linkEdges(count: number, from = 0): RelationshipEdge[] {
	return Array.from({ length: count }, (_, offset) => ({ source: MAIN, target: target(from + offset), count: 1, hierarchy: false }));
}

/** Every note `linkEdges` can name, with enough prose. */
function prose(count: number): NoteTextProvider {
	const texts: Record<string, string> = { [MAIN]: PROSE };
	for (let index = 0; index < count; index += 1) {
		texts[target(index)] = PROSE;
	}
	return new FakeNoteTextProvider(texts);
}

/** Lets every pending promise chain run (one macrotask turn) — no timers, no sleeps. */
function settled(): Promise<void> {
	return new Promise((resolve) => setImmediate(resolve));
}

/**
 * The world around one view: what is stored, and the graph on screen. Saving an AI
 * name stores it and — like the real guarded write's fan-out — repaints the view,
 * which is a new build OFFERED AS A DATA CHANGE. That loop is the repaint chain the
 * gate must not feed.
 */
class World implements AiRelationshipWriterPort {
	readonly stored = new Map<string, StoredRelationship>();
	edges: readonly RelationshipEdge[] = [];
	settings: RelationshipSettings = ON;
	gate: AiAutoNamingGate | null = null;
	rebuildsAsUserRequest = 0;

	saveAiRelationship(sourcePath: string, targetPath: string, named: AiNamedRelationship): Promise<void> {
		this.stored.set(directedLinkKey(asVaultPath(sourcePath), asVaultPath(targetPath)), { name: named.name, origin: "ai" });
		this.build("data-change");
		return Promise.resolve();
	}

	/** One published build of the graph on screen, offered to the gate. */
	build(trigger: BuildTrigger, extra: Partial<AutoNamingOffer> = {}): void {
		this.gate?.offerBuild({
			edges: this.edges,
			sources: { syntax: new Map(), stored: new Map(this.stored) },
			groupedPaths: new Set(),
			syntaxUnreadSources: new Set(),
			settings: this.settings,
			trigger,
			...extra,
		});
	}
}

interface Harness {
	readonly world: World;
	readonly namer: FakeRelationshipNamer;
	readonly gate: AiAutoNamingGate;
}

function given(
	edges: readonly RelationshipEdge[],
	answer: () => RelationshipNamingOutcome = () => NAMED,
	texts: NoteTextProvider = prose(edges.length),
): Harness {
	const world = new World();
	world.edges = edges;
	const namer = new FakeRelationshipNamer(answer);
	const gate = new AiAutoNamingGate(new AiRelationshipQueue(namer, texts, world), () => {
		world.rebuildsAsUserRequest += 1;
	});
	world.gate = gate;
	return { world, namer, gate };
}

describe("AiAutoNamingGate — on and off", () => {
	it("WHEN auto mode is off THEN a user's build asks nothing", async () => {
		const { world, namer } = given(linkEdges(1));
		world.settings = OFF;
		world.build("user-request");
		await settled();
		expect(namer.requests).toEqual([]);
	});

	it("WHEN auto mode is on THEN a user's build asks about its unnamed edge", async () => {
		const { world, namer } = given(linkEdges(1));
		world.build("user-request");
		await settled();
		expect(namer.requests.length).toBe(1);
	});

	it("WHEN asked THEN the request carries the model and effort from the settings", async () => {
		const { world, namer } = given(linkEdges(1));
		world.settings = { ...ON, model: "gpt-other", reasoningEffort: "high" };
		world.build("user-request");
		await settled();
		expect(namer.requests[0]?.config).toEqual({ model: "gpt-other", effort: "high" });
	});

	it("WHEN an edge is already named by its source note THEN it is not asked about", async () => {
		const { world, namer } = given(linkEdges(1));
		world.build("user-request", {
			sources: { syntax: new Map([[directedLinkKey(MAIN, target(0)), ["improves"]]]), stored: new Map() },
		});
		await settled();
		expect(namer.requests).toEqual([]);
	});

	it("WHEN an edge's note renders inside a folder group THEN it is not asked about", async () => {
		const { world, namer } = given(linkEdges(1));
		world.build("user-request", { groupedPaths: new Set([target(0)]) });
		await settled();
		expect(namer.requests).toEqual([]);
	});

	it("WHEN the source's own names could not be read THEN its edge is not asked about", async () => {
		// The link cache lagging an id just written into the note: unknown is not unnamed.
		const { world, namer } = given(linkEdges(1));
		world.build("user-request", { syntaxUnreadSources: new Set([MAIN]) });
		await settled();
		expect(namer.requests).toEqual([]);
	});

	it("WHEN auto mode is turned off while notes are still being read THEN nothing is asked", async () => {
		let openTexts: () => void = () => undefined;
		const gateOpen = new Promise<void>((resolve) => {
			openTexts = resolve;
		});
		const slowTexts: NoteTextProvider = {
			noteTextOf: async () => {
				await gateOpen;
				return PROSE;
			},
		};
		const { world, namer } = given(linkEdges(2), () => NAMED, slowTexts);
		world.build("user-request");
		world.settings = OFF;
		world.build("data-change");
		openTexts();
		await settled();
		expect(namer.requests).toEqual([]);
	});

	it("WHEN auto mode is turned off and on again THEN the graph on screen is asked about", async () => {
		const { world, namer } = given(linkEdges(1), () => ({ kind: "declined", reason: "refusal", usage: null }));
		world.settings = OFF;
		world.build("user-request");
		world.settings = ON;
		world.build("data-change");
		await settled();
		expect(namer.requests.length).toBe(1);
	});
});

describe("AiAutoNamingGate — no AI repaint chain", () => {
	it(`WHEN stored AI names repaint the view THEN one user request asks at most ${AI_MAX_REQUESTS_PER_BUILD}`, async () => {
		// GIVEN more unnamed edges than one build may ask about; every answer is stored,
		// and every store repaints the view as a data-change build (World.saveAiRelationship).
		const { world, namer } = given(linkEdges(AI_MAX_REQUESTS_PER_BUILD + 5));
		world.build("user-request");
		await settled();
		await settled();
		expect(namer.requests.length).toBe(AI_MAX_REQUESTS_PER_BUILD);
	});

	it("WHEN a data change shows no new edge (an id written into a note) THEN nothing more is asked", async () => {
		const { world, namer } = given(linkEdges(AI_MAX_REQUESTS_PER_BUILD + 5));
		world.build("user-request");
		await settled();
		world.build("data-change");
		await settled();
		expect(namer.requests.length).toBe(AI_MAX_REQUESTS_PER_BUILD);
	});

	it("WHEN a data change only shows a note whose names were unknown (its link cache caught up) THEN nothing more is asked", async () => {
		// GIVEN a backlog past the cap, plus one note whose names were unread at the user's
		// request — the lag an id write into its frontmatter leaves while a name is stored.
		const other = asVaultPath("other.md");
		const edges = [...linkEdges(AI_MAX_REQUESTS_PER_BUILD + 5), { source: other, target: target(0), count: 1, hierarchy: false }];
		const texts = new FakeNoteTextProvider({ ...Object.fromEntries(edges.map((edge) => [edge.target, PROSE])), [MAIN]: PROSE, [other]: PROSE });
		const { world, namer } = given(edges, () => NAMED, texts);
		world.build("user-request", { syntaxUnreadSources: new Set([other]) });
		await settled();
		world.build("data-change");
		await settled();
		expect(namer.requests.length).toBe(AI_MAX_REQUESTS_PER_BUILD);
	});

	it("WHEN a data change shows a new edge (a link the user typed) THEN that edge is asked about", async () => {
		const { world, namer } = given(linkEdges(1), () => NAMED, prose(2));
		world.build("user-request");
		await settled();
		world.edges = linkEdges(2);
		world.build("data-change");
		await settled();
		expect(namer.requests.length).toBe(2);
	});

	it("WHEN a data change shows again an edge an earlier build since the user's request showed THEN it is not new", async () => {
		// GIVEN a backlog past the cap; the user swaps the last link for a new one (a new
		// edge may restart the backlog), then undoes the swap.
		const backlog = AI_MAX_REQUESTS_PER_BUILD + 5;
		const newLink = linkEdges(1, backlog);
		const { world, namer } = given(linkEdges(backlog), () => NAMED, prose(backlog + 1));
		world.build("user-request");
		await settled();
		world.edges = [...linkEdges(backlog - 1), ...newLink];
		world.build("data-change");
		await settled();
		const askedBeforeUndo = namer.requests.length;
		world.edges = [...linkEdges(backlog), ...newLink];
		world.build("data-change");
		await settled();
		expect(namer.requests.length).toBe(askedBeforeUndo);
	});

	it("WHEN the user asks for the graph again THEN the next unnamed edges are asked about", async () => {
		const { world, namer } = given(linkEdges(AI_MAX_REQUESTS_PER_BUILD + 5));
		world.build("user-request");
		await settled();
		world.build("user-request");
		await settled();
		expect(namer.requests.length).toBe(AI_MAX_REQUESTS_PER_BUILD + 5);
	});
});

describe("AiAutoNamingGate — after a stop", () => {
	it("WHEN the key is missing THEN the status reports the stop", async () => {
		const { world, gate } = given(linkEdges(1), () => NO_KEY);
		world.build("user-request");
		await settled();
		expect({ stopped: gate.status().stopped, lastFailure: gate.status().lastFailure }).toEqual({
			stopped: true,
			lastFailure: "no-key",
		});
	});

	it("WHEN the user picks another key THEN the stop is lifted and the graph is asked about again", async () => {
		const answers = [NO_KEY, NAMED];
		const { world, namer } = given(linkEdges(1), () => answers.shift() ?? NAMED);
		world.build("user-request");
		await settled();
		world.settings = { ...ON, apiKeySecretName: "openai" };
		world.build("data-change");
		await settled();
		expect(namer.requests.length).toBe(2);
	});

	it("WHEN retried THEN the stop is lifted and the view rebuilds as a user request", async () => {
		const { world, gate } = given(linkEdges(1), () => NO_KEY);
		world.build("user-request");
		await settled();
		gate.retry();
		expect({ stopped: gate.status().stopped, rebuilds: world.rebuildsAsUserRequest }).toEqual({ stopped: false, rebuilds: 1 });
	});
});
