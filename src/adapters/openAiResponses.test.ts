import { describe, expect, it } from "vitest";
import { RELATIONSHIP_NAME_JSON_SCHEMA } from "../engine";
import type { AiNamingFailure } from "../engine";
import { isSuccessStatus, meaningOfErrorStatus, openAiRequestBody, parseOpenAiAnswer } from "./openAiResponses";
import type { OpenAiErrorMeaning } from "./openAiResponses";

const PROMPT = { instructions: "Name it.", input: "<source_note>…</source_note>" };
const CONFIG = { model: "gpt-6-luna", effort: "medium" } as const;
const USAGE_BODY = { input_tokens: 1200, output_tokens: 40 };
const USAGE = { inputTokens: 1200, outputTokens: 40 };

const REASONING_ITEM = { type: "reasoning", id: "rs_1", summary: [] };

function messageWith(content: readonly unknown[]): unknown {
	return { type: "message", role: "assistant", content };
}

describe("openAiRequestBody", () => {
	it("WHEN built THEN it is the Responses request with strict structured output", () => {
		expect(openAiRequestBody(PROMPT, CONFIG)).toEqual({
			model: "gpt-6-luna",
			instructions: "Name it.",
			input: "<source_note>…</source_note>",
			reasoning: { effort: "medium" },
			text: { format: { type: "json_schema", name: "relationship_name", strict: true, schema: RELATIONSHIP_NAME_JSON_SCHEMA } },
		});
	});

	it("WHEN built THEN the schema forbids any field but name", () => {
		expect(RELATIONSHIP_NAME_JSON_SCHEMA).toMatchObject({ required: ["name"], additionalProperties: false });
	});
});

describe("parseOpenAiAnswer", () => {
	it("WHEN the message is the only output item THEN its output_text is the answer", () => {
		const body = { output: [messageWith([{ type: "output_text", text: '{"name":"causes"}' }])], usage: USAGE_BODY };
		expect(parseOpenAiAnswer(body)).toEqual({ kind: "text", text: '{"name":"causes"}', usage: USAGE });
	});

	it("WHEN a reasoning item comes first THEN the message after it is still the answer", () => {
		const body = { output: [REASONING_ITEM, messageWith([{ type: "output_text", text: '{"name":"causes"}' }])], usage: USAGE_BODY };
		expect(parseOpenAiAnswer(body)).toEqual({ kind: "text", text: '{"name":"causes"}', usage: USAGE });
	});

	it("WHEN the message carries a refusal THEN the answer is a refusal, with its usage", () => {
		const body = { output: [REASONING_ITEM, messageWith([{ type: "refusal", refusal: "I can't help." }])], usage: USAGE_BODY };
		expect(parseOpenAiAnswer(body)).toEqual({ kind: "refusal", usage: USAGE });
	});

	it("WHEN the body reports no usage THEN usage is null, never zero", () => {
		const body = { output: [messageWith([{ type: "output_text", text: "{}" }])] };
		expect(parseOpenAiAnswer(body)).toEqual({ kind: "text", text: "{}", usage: null });
	});

	it("WHEN there is no message item THEN the body is malformed", () => {
		expect(parseOpenAiAnswer({ output: [REASONING_ITEM], usage: USAGE_BODY })).toEqual({ kind: "malformed" });
	});

	it("WHEN the message has neither text nor refusal THEN the body is malformed", () => {
		expect(parseOpenAiAnswer({ output: [messageWith([{ type: "other" }])] })).toEqual({ kind: "malformed" });
	});

	it("WHEN the body is not an object THEN it is malformed", () => {
		expect(parseOpenAiAnswer(null)).toEqual({ kind: "malformed" });
	});
});

describe("isSuccessStatus", () => {
	it("WHEN the status is 200 THEN it is a success", () => {
		expect(isSuccessStatus(200)).toBe(true);
	});

	it("WHEN the status is 400 THEN it is not a success", () => {
		expect(isSuccessStatus(400)).toBe(false);
	});
});

describe("meaningOfErrorStatus", () => {
	function errorBody(code: string): unknown {
		return { error: { message: "…", type: "…", code } };
	}

	function failure(kind: AiNamingFailure): OpenAiErrorMeaning {
		return { kind: "failure", failure: kind };
	}

	const table: readonly { readonly when: string; readonly status: number; readonly json: unknown; readonly then: OpenAiErrorMeaning }[] = [
		{ when: "401", status: 401, json: null, then: failure("bad-key") },
		{ when: "404", status: 404, json: null, then: failure("unknown-model") },
		{ when: "403", status: 403, json: null, then: failure("unknown-model") },
		{ when: "400 model_not_found", status: 400, json: errorBody("model_not_found"), then: failure("unknown-model") },
		{ when: "429 rate limit", status: 429, json: errorBody("rate_limit_exceeded"), then: failure("rate-limited") },
		{ when: "429 without a code", status: 429, json: null, then: failure("rate-limited") },
		{ when: "429 insufficient_quota", status: 429, json: errorBody("insufficient_quota"), then: failure("quota-exhausted") },
		{ when: "400 context_length_exceeded", status: 400, json: errorBody("context_length_exceeded"), then: { kind: "notes-too-long" } },
		{ when: "400 for anything else", status: 400, json: errorBody("unsupported_value"), then: failure("rejected-request") },
		{ when: "422", status: 422, json: null, then: failure("rejected-request") },
		{ when: "500", status: 500, json: null, then: failure("server-error") },
		{ when: "503", status: 503, json: null, then: failure("server-error") },
		{ when: "302", status: 302, json: null, then: failure("unexpected-response") },
	];

	for (const row of table) {
		it(`WHEN OpenAI answers ${row.when} THEN it means ${JSON.stringify(row.then)}`, () => {
			expect(meaningOfErrorStatus(row.status, row.json)).toEqual(row.then);
		});
	}
});
