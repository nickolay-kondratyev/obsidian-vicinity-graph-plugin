import { describe, expect, it } from "vitest";
import type { RelationshipNamingOutcome, RelationshipNamingRequest } from "../engine";
import { FakeApiKeySource } from "./FakeApiKeySource";
import { FakeJsonHttpPort } from "./FakeJsonHttpPort";
import type { JsonHttpResponse } from "./JsonHttpPort";
import { OPENAI_RESPONSES_URL } from "./openAiResponses";
import { OpenAiRelationshipNamer } from "./OpenAiRelationshipNamer";

const KEY = "sk-test-secret-key";
const REQUEST: RelationshipNamingRequest = {
	prompt: { instructions: "Name it.", input: "notes" },
	config: { model: "gpt-6-luna", effort: "medium" },
};
const USAGE_BODY = { input_tokens: 900, output_tokens: 12 };

function answered(text: string): JsonHttpResponse {
	return {
		status: 200,
		json: {
			output: [{ type: "reasoning", summary: [] }, { type: "message", content: [{ type: "output_text", text }] }],
			usage: USAGE_BODY,
		},
	};
}

interface Harness {
	readonly namer: OpenAiRelationshipNamer;
	readonly http: FakeJsonHttpPort;
}

/** GIVEN a key (or none) and an HTTP answer (a throw = the network is down). */
function given(key: string | null, answer: () => JsonHttpResponse): Harness {
	const http = new FakeJsonHttpPort(answer);
	return { namer: new OpenAiRelationshipNamer(new FakeApiKeySource(key), http), http };
}

describe("OpenAiRelationshipNamer — a request", () => {
	it("WHEN a pair is named THEN it POSTs to the Responses endpoint", async () => {
		const { namer, http } = given(KEY, () => answered('{"name":"causes"}'));
		await namer.nameRelationship(REQUEST);
		expect(http.requests.map((request) => request.url)).toEqual([OPENAI_RESPONSES_URL]);
	});

	it("WHEN a pair is named THEN the key travels as a Bearer header", async () => {
		const { namer, http } = given(KEY, () => answered('{"name":"causes"}'));
		await namer.nameRelationship(REQUEST);
		expect(http.requests[0]?.headers).toEqual({ Authorization: `Bearer ${KEY}` });
	});

	it("WHEN a pair is named THEN the body asks the configured model at the configured effort", async () => {
		const { namer, http } = given(KEY, () => answered('{"name":"causes"}'));
		await namer.nameRelationship(REQUEST);
		expect(http.requests[0]?.body).toMatchObject({ model: "gpt-6-luna", reasoning: { effort: "medium" } });
	});
});

describe("OpenAiRelationshipNamer — outcomes", () => {
	const table: readonly { readonly when: string; readonly key: string | null; readonly answer: () => JsonHttpResponse; readonly then: RelationshipNamingOutcome }[] = [
		{
			when: "the model answers a valid name",
			key: KEY,
			answer: () => answered('{"name":"causes"}'),
			then: { kind: "named", name: "causes" as never, usage: { inputTokens: 900, outputTokens: 12 } },
		},
		{
			when: "the model answers an empty name",
			key: KEY,
			answer: () => answered('{"name":""}'),
			then: { kind: "declined", reason: "invalid-name", usage: { inputTokens: 900, outputTokens: 12 } },
		},
		{
			when: "the model refuses",
			key: KEY,
			answer: () => ({ status: 200, json: { output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] } }),
			then: { kind: "declined", reason: "refusal", usage: null },
		},
		{
			when: "the notes are too long for the model",
			key: KEY,
			answer: () => ({ status: 400, json: { error: { code: "context_length_exceeded" } } }),
			then: { kind: "declined", reason: "notes-too-long", usage: null },
		},
		{ when: "there is no key", key: null, answer: () => answered("{}"), then: { kind: "failed", failure: "no-key" } },
		{ when: "the key is refused (401)", key: KEY, answer: () => ({ status: 401, json: null }), then: { kind: "failed", failure: "bad-key" } },
		{ when: "the model is unknown (404)", key: KEY, answer: () => ({ status: 404, json: null }), then: { kind: "failed", failure: "unknown-model" } },
		{ when: "rate-limited (429)", key: KEY, answer: () => ({ status: 429, json: null }), then: { kind: "failed", failure: "rate-limited" } },
		{
			when: "the network is down",
			key: KEY,
			answer: () => {
				throw new Error(`net::ERR_INTERNET_DISCONNECTED Bearer ${KEY}`);
			},
			then: { kind: "failed", failure: "network" },
		},
		{ when: "a 200 body is not the Responses shape", key: KEY, answer: () => ({ status: 200, json: null }), then: { kind: "failed", failure: "unexpected-response" } },
	];

	for (const row of table) {
		it(`WHEN ${row.when} THEN the outcome is ${row.then.kind}`, async () => {
			const { namer } = given(row.key, row.answer);
			expect(await namer.nameRelationship(REQUEST)).toEqual(row.then);
		});
	}

	it("WHEN there is no key THEN nothing is sent", async () => {
		const { namer, http } = given(null, () => answered("{}"));
		await namer.nameRelationship(REQUEST);
		expect(http.requests).toEqual([]);
	});

	it("WHEN the network error message echoes the key THEN the outcome still never carries it", async () => {
		const { namer } = given(KEY, () => {
			throw new Error(`failed Bearer ${KEY}`);
		});
		expect(JSON.stringify(await namer.nameRelationship(REQUEST))).not.toContain(KEY);
	});
});
