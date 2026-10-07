import type { RelationshipNamer, RelationshipNamingOutcome, RelationshipNamingRequest } from "../engine";
import { parseModelRelationshipName } from "../engine";
import type { ApiKeySource } from "./ApiKeySource";
import type { JsonHttpPort, JsonHttpResponse } from "./JsonHttpPort";
import { isSuccessStatus, meaningOfErrorStatus, OPENAI_RESPONSES_URL, openAiRequestBody, parseOpenAiAnswer } from "./openAiResponses";

/**
 * {@link RelationshipNamer} over the OpenAI Responses API (task 3/4
 * `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`). Thin: the wire format is
 * `openAiResponses.ts`, the name rule is the engine's. The key is read per call
 * and only ever placed in the `Authorization` header — never logged, never in an
 * outcome. NEVER rejects.
 */
export class OpenAiRelationshipNamer implements RelationshipNamer {
	constructor(
		private readonly keys: ApiKeySource,
		private readonly http: JsonHttpPort,
	) {}

	async nameRelationship(request: RelationshipNamingRequest): Promise<RelationshipNamingOutcome> {
		const key = this.keys.apiKey();
		if (key === null) {
			return { kind: "failed", failure: "no-key" };
		}
		let response: JsonHttpResponse;
		try {
			response = await this.http.postJson({
				url: OPENAI_RESPONSES_URL,
				headers: { Authorization: `Bearer ${key}` },
				body: openAiRequestBody(request.prompt, request.config),
			});
		} catch {
			// WHY nothing is logged: the transport's error may echo the request, header included.
			return { kind: "failed", failure: "network" };
		}
		return isSuccessStatus(response.status) ? OpenAiRelationshipNamer.answerOf(response.json) : OpenAiRelationshipNamer.errorOf(response);
	}

	private static answerOf(json: unknown): RelationshipNamingOutcome {
		const answer = parseOpenAiAnswer(json);
		switch (answer.kind) {
			case "malformed":
				return { kind: "failed", failure: "unexpected-response" };
			case "refusal":
				return { kind: "declined", reason: "refusal", usage: answer.usage };
			case "incomplete":
				return { kind: "declined", reason: "incomplete", usage: answer.usage };
			case "text": {
				const parsed = parseModelRelationshipName(answer.text);
				return parsed.kind === "valid"
					? { kind: "named", name: parsed.name, usage: answer.usage }
					: { kind: "declined", reason: "invalid-name", usage: answer.usage };
			}
		}
	}

	private static errorOf(response: JsonHttpResponse): RelationshipNamingOutcome {
		const meaning = meaningOfErrorStatus(response.status, response.json);
		return meaning.kind === "notes-too-long"
			? { kind: "declined", reason: "notes-too-long", usage: null }
			: { kind: "failed", failure: meaning.failure };
	}
}
