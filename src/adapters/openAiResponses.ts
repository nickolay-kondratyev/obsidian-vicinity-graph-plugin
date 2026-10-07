import type { AiNamingConfig, AiNamingFailure, RelationshipPrompt, RelationshipTokenUsage } from "../engine";
import { RELATIONSHIP_NAME_JSON_SCHEMA, RELATIONSHIP_NAME_SCHEMA_NAME } from "../engine";

/**
 * The OpenAI Responses API wire format, as far as the relationship namer uses it
 * (task 3/4 `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`). Pure — no `obsidian`, no I/O —
 * so request building, response reading and status mapping are table-tested
 * without a live call.
 */

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_CLIENT_ERROR_MAX = 499;
const HTTP_SERVER_ERROR_MIN = 500;
const HTTP_SERVER_ERROR_MAX = 599;
const HTTP_SUCCESS_MIN = 200;
const HTTP_SUCCESS_MAX = 299;

/** OpenAI `error.code` values that change what a status means. */
const QUOTA_EXHAUSTED_CODE = "insufficient_quota";
const CONTEXT_TOO_LONG_CODE = "context_length_exceeded";
const MODEL_NOT_FOUND_CODE = "model_not_found";

/** The request body: our prompt, the chosen model/effort, and strict structured output (`{ name }`). */
export function openAiRequestBody(prompt: RelationshipPrompt, config: AiNamingConfig): unknown {
	return {
		model: config.model,
		instructions: prompt.instructions,
		input: prompt.input,
		reasoning: { effort: config.effort },
		text: {
			format: {
				type: "json_schema",
				name: RELATIONSHIP_NAME_SCHEMA_NAME,
				strict: true,
				schema: RELATIONSHIP_NAME_JSON_SCHEMA,
			},
		},
	};
}

export function isSuccessStatus(status: number): boolean {
	return status >= HTTP_SUCCESS_MIN && status <= HTTP_SUCCESS_MAX;
}

/** What a successful (2xx) body said. */
export type OpenAiAnswer =
	| { readonly kind: "text"; readonly text: string; readonly usage: RelationshipTokenUsage | null }
	| { readonly kind: "refusal"; readonly usage: RelationshipTokenUsage | null }
	| { readonly kind: "malformed" };

function recordOf(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function usageOf(body: Record<string, unknown>): RelationshipTokenUsage | null {
	const usage = recordOf(body["usage"]);
	const inputTokens = usage?.["input_tokens"];
	const outputTokens = usage?.["output_tokens"];
	return typeof inputTokens === "number" && typeof outputTokens === "number" ? { inputTokens, outputTokens } : null;
}

/**
 * Reads a 2xx body: the FIRST `output[]` item of `type: "message"` — reasoning
 * items may come before it — then its `content[]`: an `output_text` part carries
 * the structured JSON, a `refusal` part means the model declined.
 */
export function parseOpenAiAnswer(json: unknown): OpenAiAnswer {
	const body = recordOf(json);
	const output = body?.["output"];
	if (body === null || !Array.isArray(output)) {
		return { kind: "malformed" };
	}
	const message = output.map(recordOf).find((item) => item?.["type"] === "message");
	const content = message?.["content"];
	if (!Array.isArray(content)) {
		return { kind: "malformed" };
	}
	const usage = usageOf(body);
	for (const part of content.map(recordOf)) {
		if (part?.["type"] === "output_text" && typeof part["text"] === "string") {
			return { kind: "text", text: part["text"], usage };
		}
		if (part?.["type"] === "refusal") {
			return { kind: "refusal", usage };
		}
	}
	return { kind: "malformed" };
}

/** A non-2xx answer: either the setup is wrong (an {@link AiNamingFailure}) or THIS pair is too big. */
export type OpenAiErrorMeaning =
	| { readonly kind: "failure"; readonly failure: AiNamingFailure }
	| { readonly kind: "notes-too-long" };

function errorCodeOf(json: unknown): string | null {
	const code = recordOf(recordOf(json)?.["error"])?.["code"];
	return typeof code === "string" ? code : null;
}

function failure(kind: AiNamingFailure): OpenAiErrorMeaning {
	return { kind: "failure", failure: kind };
}

/** Maps a non-2xx status (and OpenAI's `error.code`, where it disambiguates) to what it means for the user. */
export function meaningOfErrorStatus(status: number, json: unknown): OpenAiErrorMeaning {
	const code = errorCodeOf(json);
	if (code === MODEL_NOT_FOUND_CODE || status === HTTP_NOT_FOUND || status === HTTP_FORBIDDEN) {
		return failure("unknown-model");
	}
	if (status === HTTP_UNAUTHORIZED) {
		return failure("bad-key");
	}
	if (status === HTTP_TOO_MANY_REQUESTS) {
		return failure(code === QUOTA_EXHAUSTED_CODE ? "quota-exhausted" : "rate-limited");
	}
	if (status === HTTP_BAD_REQUEST && code === CONTEXT_TOO_LONG_CODE) {
		return { kind: "notes-too-long" };
	}
	if (status >= HTTP_BAD_REQUEST && status <= HTTP_CLIENT_ERROR_MAX) {
		return failure("rejected-request");
	}
	if (status >= HTTP_SERVER_ERROR_MIN && status <= HTTP_SERVER_ERROR_MAX) {
		return failure("server-error");
	}
	return failure("unexpected-response");
}
