import { requestUrl } from "obsidian";
import type { JsonHttpPort, JsonHttpRequest, JsonHttpResponse } from "./JsonHttpPort";

const JSON_CONTENT_TYPE = "application/json";

/**
 * {@link JsonHttpPort} over Obsidian's `requestUrl`. Kept apart from the pure
 * protocol code because it imports the `obsidian` RUNTIME, which `npm test`
 * cannot load (types-only there).
 */
export class ObsidianJsonHttp implements JsonHttpPort {
	async postJson(request: JsonHttpRequest): Promise<JsonHttpResponse> {
		const response = await requestUrl({
			url: request.url,
			method: "POST",
			contentType: JSON_CONTENT_TYPE,
			headers: { ...request.headers },
			body: JSON.stringify(request.body),
			// Answer 4xx/5xx instead of throwing, so the status reaches the error mapping.
			throw: false,
		});
		return { status: response.status, json: ObsidianJsonHttp.parsedOrNull(response.text) };
	}

	/** WHY not `response.json`: that getter throws on a non-JSON body (e.g. a proxy's HTML error page). */
	private static parsedOrNull(text: string): unknown {
		try {
			return JSON.parse(text) as unknown;
		} catch {
			return null;
		}
	}
}
