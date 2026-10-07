import type { RelationshipName, RelationshipNameRejection } from "../engine";
import { MAX_RELATIONSHIP_NAME_LENGTH, parseRelationshipName } from "../engine";

/**
 * What ended an edit of the drawer's relationship-name field. The field commits
 * on COMMIT (Enter / leaving it), never per keystroke — the same rule the typed
 * settings fields follow.
 */
export type RelationshipNameCommitTrigger = "enter" | "blur";

/** What committing the typed text does. */
export type RelationshipNameCommit =
	| { readonly kind: "save"; readonly name: RelationshipName }
	/** Nothing to store: the field just closes. */
	| { readonly kind: "cancel" }
	/** The field stays open with the user's text and this plain-language reason. */
	| { readonly kind: "refuse"; readonly message: string };

/** The refusal copy — plain language: what is wrong and how to fix it. */
export function describeRelationshipNameRejection(reason: RelationshipNameRejection): string {
	switch (reason) {
		case "empty":
			return "Type a name, or press Escape to cancel.";
		case "too-long":
			return `Keep the name to ${MAX_RELATIONSHIP_NAME_LENGTH} characters or fewer.`;
	}
}

/**
 * Decides one commit of the name field (pure). Leaving an EMPTY field is
 * walking away, not a mistake, so it cancels; pressing Enter on one is an
 * attempt to save nothing, so it is refused with the way out. An unchanged name
 * writes nothing. An over-long name is refused either way, keeping the text.
 */
export function decideRelationshipNameCommit(
	typed: string,
	currentName: string | null,
	trigger: RelationshipNameCommitTrigger,
): RelationshipNameCommit {
	const parsed = parseRelationshipName(typed);
	if (parsed.kind === "refused") {
		if (parsed.reason === "empty" && trigger === "blur") {
			return { kind: "cancel" };
		}
		return { kind: "refuse", message: describeRelationshipNameRejection(parsed.reason) };
	}
	if (parsed.name === currentName) {
		return { kind: "cancel" };
	}
	return { kind: "save", name: parsed.name };
}
