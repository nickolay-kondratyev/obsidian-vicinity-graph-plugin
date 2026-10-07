import type { JsonHttpPort, JsonHttpRequest, JsonHttpResponse } from "./JsonHttpPort";

/** Records every request and answers from a script; `answer` may throw to simulate the network being down. */
export class FakeJsonHttpPort implements JsonHttpPort {
	readonly requests: JsonHttpRequest[] = [];

	constructor(private readonly answer: (request: JsonHttpRequest) => JsonHttpResponse) {}

	// `async` so a throwing script becomes a REJECTION, as a real transport failure is.
	async postJson(request: JsonHttpRequest): Promise<JsonHttpResponse> {
		this.requests.push(request);
		return this.answer(request);
	}
}
