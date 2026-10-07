import type { RelationshipName } from "./RelationshipName";
import { parseRelationshipName } from "./RelationshipName";

/**
 * The AI relationship prompt (task 3/4 `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`) and
 * the validator of what comes back. Pure and provider-neutral: the adapter wraps
 * {@link RelationshipPrompt} and {@link RELATIONSHIP_NAME_JSON_SCHEMA} into its
 * own request shape.
 *
 * KISS by decision: BOTH notes go in FULL (the source still contains its
 * `[[target]]` link, which is the context the name is about). Known ceiling: no
 * truncation, so a huge note costs more (and one past the model's ~922K input
 * tokens fails as `notes-too-long` for that pair only). Upgrade path: a per-note
 * character cap here, added only once a real vault hits it.
 */

/**
 * Names the model should prefer WHEN ONE FITS WELL, so the same relation reads
 * the same across the vault. Human-approved 2026-10-06; `related-to` was dropped
 * as too vague. Never forced — any other specific name is equally fine.
 */
export const AI_ANCHOR_RELATIONSHIP_NAMES = [
	"increases",
	"decreases",
	"causes",
	"prevents",
	"enables",
	"depends-on",
	"supports",
	"contradicts",
	"improves",
	"replaces",
	"part-of",
	"example-of",
	"instance-of",
	"defines",
	"explains",
	"extends",
	"uses",
	"references",
] as const;

/** Names the prompt steers AWAY from: they say "there is a link", which the edge already says. */
const VAGUE_RELATIONSHIP_NAMES = ["related", "related-to", "links-to", "mentions"] as const;

/** One note as the model sees it. `text` is the note's full content (a canvas: its text cards). */
export interface RelationshipPromptNote {
	readonly title: string;
	readonly text: string;
}

/** Provider-neutral prompt: standing `instructions` + the per-edge `input`. */
export interface RelationshipPrompt {
	readonly instructions: string;
	readonly input: string;
}

/** The structured-output schema's name — what the provider echoes back as the format's id. */
export const RELATIONSHIP_NAME_SCHEMA_NAME = "relationship_name";

/**
 * Structured output: exactly `{ "name": string }`. `additionalProperties: false`
 * and `required` are what strict JSON-schema mode demands.
 */
export const RELATIONSHIP_NAME_JSON_SCHEMA = {
	type: "object",
	properties: { name: { type: "string" } },
	required: ["name"],
	additionalProperties: false,
} as const;

const RELATIONSHIP_INSTRUCTIONS = [
	"You name the relationship between two notes from a personal knowledge base.",
	"The SOURCE note links to the TARGET note. Give ONE name for that link, read from the source's point of view:",
	'"<source title> <name> <target title>".',
	"",
	"Rules:",
	'- Use short kebab-case: lowercase words joined by hyphens (for example "depends-on").',
	"- Be SPECIFIC: say how the source relates to the target.",
	`- Avoid vague names such as ${VAGUE_RELATIONSHIP_NAMES.map((name) => `"${name}"`).join(", ")}.`,
	`- Anchor names: ${AI_ANCHOR_RELATIONSHIP_NAMES.join(", ")}.`,
	"  Use an anchor name ONLY when it fits well, so the same relation reads the same everywhere.",
	"  Any other specific name is equally fine; never force an anchor.",
	'- Answer with JSON: {"name": "<name>"}.',
].join("\n");

function noteBlock(role: "source" | "target", note: RelationshipPromptNote): string {
	return [`<${role}_note title=${JSON.stringify(note.title)}>`, note.text, `</${role}_note>`].join("\n");
}

/** The prompt naming `source → target`, from the source's point of view. */
export function buildRelationshipPrompt(source: RelationshipPromptNote, target: RelationshipPromptNote): RelationshipPrompt {
	return {
		instructions: RELATIONSHIP_INSTRUCTIONS,
		input: [noteBlock("source", source), noteBlock("target", target)].join("\n\n"),
	};
}

export type ModelRelationshipNameParse =
	| { readonly kind: "valid"; readonly name: RelationshipName }
	| { readonly kind: "invalid" };

/**
 * Validates the model's structured-output TEXT (`{"name": "..."}`) with the SAME
 * rule a typed name passes ({@link parseRelationshipName}) — an AI name is stored
 * and shown exactly like a manual one, so it gets no looser a check.
 */
export function parseModelRelationshipName(outputText: string): ModelRelationshipNameParse {
	let parsed: unknown;
	try {
		parsed = JSON.parse(outputText);
	} catch {
		return { kind: "invalid" };
	}
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		return { kind: "invalid" };
	}
	const name = (parsed as Record<string, unknown>)["name"];
	if (typeof name !== "string") {
		return { kind: "invalid" };
	}
	const validated = parseRelationshipName(name);
	return validated.kind === "valid" ? { kind: "valid", name: validated.name } : { kind: "invalid" };
}
