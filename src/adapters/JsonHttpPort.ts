/**
 * The plugin's ONE outbound-HTTP seam (task 3/4 `nid_cbnhpdfn4myqfzqr8weyg7kq5_e`).
 * The real one is `ObsidianJsonHttp` over Obsidian's `requestUrl` (no CORS, and no
 * `fetch(` token in the bundle — see `src/view/libavoidTokenGuard.test.ts`); tests
 * use `FakeJsonHttpPort`.
 */
export interface JsonHttpResponse {
	readonly status: number;
	/** The parsed body, or `null` when the body is not JSON. */
	readonly json: unknown;
}

export interface JsonHttpRequest {
	readonly url: string;
	readonly headers: Readonly<Record<string, string>>;
	readonly body: unknown;
}

export interface JsonHttpPort {
	/**
	 * POSTs `body` as JSON and answers with ANY status (4xx/5xx included). Rejects
	 * only when no HTTP answer arrived at all (offline, DNS, TLS).
	 */
	postJson(request: JsonHttpRequest): Promise<JsonHttpResponse>;
}
