import type { AiNamingConfig, DirectedLink, RelationshipSettings } from "../engine";
import { aiCandidateEdges, directedLinkKey } from "../engine";
import type { AiNamingStatus, AiRelationshipQueue } from "./AiRelationshipQueue";
import type { AiNamingMenuPort, AutoNamingOffer, AutoNamingPort } from "./viewPorts";

/** What the builds since the last submitted `user-request` showed — what a later `data-change` build is compared against. */
interface Submission {
	/**
	 * {@link directedLinkKey} of every edge those builds showed unnamed OR of unknown
	 * name (a `syntax-unread` source) — accumulated, so an edge is "new" only once.
	 */
	readonly shownKeys: ReadonlySet<string>;
}

/**
 * Decides which published builds start AI naming (task 4/4
 * `nid_80xc6z8umlpo1x6u4p1v7eb22_e`), then hands their AI-candidate edges
 * (`aiCandidateEdges`: unnamed in that direction, not grouped, not a pure hierarchy
 * edge) to the plugin-lived {@link AiRelationshipQueue}. One gate per graph view.
 *
 * THE RULE — no AI repaint chain (orchestrator decision 2026-10-07): every stored AI
 * name repaints every view, and every repaint is a new build. Were each build
 * submitted, the 20-requests-per-build cap would hold per BUILD but not per user
 * action (20 answers → 20 repaints → 20 more requests …). The same goes for the
 * vault: naming a pair writes an `id` into both notes' frontmatter, so the metadata
 * cache resolves and the view rebuilds. So:
 * - a `user-request` build (the user opened or clicked a note, redrew, retried)
 *   always starts AI work — up to the cap, once per user action;
 * - a `data-change` build (a settings or stored-name write, a vault change) starts AI
 *   work ONLY when it shows a candidate edge no build since the last user request
 *   showed. An AI name's repaint and an id write add no edge, so they start nothing;
 *   a link the user just typed, or a depth they just raised, does;
 * - an edge whose source's names were UNREAD counts as shown: the id write that
 *   naming does leaves the note's link cache lagging, so its edges flip unread → read
 *   on a later rebuild. Counted as new, that flip would restart the backlog once per
 *   stored name — the very chain this gate exists to stop.
 * Known ceiling: an edge that only BECOMES nameable through a data change (a note
 * grows past the 200-character minimum, its unread names catch up) waits for the
 * next user request.
 *
 * Auto mode OFF drops queued (not in-flight) work and forgets what was offered, so
 * turning it back ON names the graph on screen. Turning it on, or changing the model,
 * effort or key, also lifts a fatal stop: the user has acted on the cause.
 */
export class AiAutoNamingGate implements AutoNamingPort, AiNamingMenuPort {
	private lastSubmission: Submission | null = null;
	/** The settings the last offered build carried; `null` before the first offer. */
	private lastSettings: RelationshipSettings | null = null;

	constructor(
		private readonly queue: AiRelationshipQueue,
		/** Rebuilds the view as a `user-request` — what {@link retry} needs to name the CURRENT graph. */
		private readonly rebuildAsUserRequest: () => void,
	) {}

	offerBuild(offer: AutoNamingOffer): void {
		const changedSettings = this.lastSettings === null || !sameRelationshipSettings(this.lastSettings, offer.settings);
		this.lastSettings = offer.settings;
		if (!offer.settings.autoNaming) {
			this.queue.cancelPending();
			this.lastSubmission = null;
			return;
		}
		if (changedSettings) {
			this.queue.resume();
			this.lastSubmission = null;
		}
		const facts = { sources: offer.sources, groupedPaths: offer.groupedPaths, syntaxUnreadSources: offer.syntaxUnreadSources };
		const candidates = aiCandidateEdges(offer.edges, facts);
		// With no unread set, `aiCandidateEdges` also keeps the edges excluded ONLY as `syntax-unread`.
		const shownKeys = keysOf(aiCandidateEdges(offer.edges, { ...facts, syntaxUnreadSources: new Set() }));
		const previous = this.lastSubmission;
		if (offer.trigger === "data-change" && previous !== null) {
			if (isSubset(keysOf(candidates), previous.shownKeys)) {
				return;
			}
			this.lastSubmission = { shownKeys: new Set([...previous.shownKeys, ...shownKeys]) };
		} else {
			this.lastSubmission = { shownKeys };
		}
		void this.queue.submitBuild(candidates, configOf(offer.settings));
	}

	// Arrow properties, not methods: React's `useSyncExternalStore` receives them unbound.
	readonly status = (): AiNamingStatus => this.queue.status();

	readonly subscribe = (listener: () => void): (() => void) => this.queue.subscribe(listener);

	retry(): void {
		this.queue.resume();
		this.rebuildAsUserRequest();
	}
}

function configOf(settings: RelationshipSettings): AiNamingConfig {
	return { model: settings.model, effort: settings.reasoningEffort };
}

function sameRelationshipSettings(a: RelationshipSettings, b: RelationshipSettings): boolean {
	return (
		a.autoNaming === b.autoNaming &&
		a.model === b.model &&
		a.reasoningEffort === b.reasoningEffort &&
		a.apiKeySecretName === b.apiKeySecretName
	);
}

function keysOf(edges: readonly DirectedLink[]): ReadonlySet<string> {
	return new Set(edges.map((edge) => directedLinkKey(edge.source, edge.target)));
}

function isSubset(keys: ReadonlySet<string>, of: ReadonlySet<string>): boolean {
	for (const key of keys) {
		if (!of.has(key)) {
			return false;
		}
	}
	return true;
}
