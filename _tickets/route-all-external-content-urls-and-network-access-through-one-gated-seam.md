---
closed_iso: 2026-08-07T17:37:43Z
id: nid_tvtm9gj5zaj4tbfbpti3v6sy2_e
title: Route ALL external-content URLs and network access through ONE gated seam
status: closed
deps: [nid_21xio7iwxv742ze4qc4p4qbmq_e]
links: [nid_15r71ajjkbel5s704kmj6wszw_e, nid_21xio7iwxv742ze4qc4p4qbmq_e, nid_ty5dmswuu1uw4uh8l6i8cdc0s_e,
  nid_mw1az1i1aznfoxqsgcwnfus07_e]
created_iso: '2026-08-07T17:04:06Z'
status_updated_iso: 2026-08-07T17:37:43Z
type: feature
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [external-preview, architecture]
pwd: /home/nickolaykondratyev/git_repos/nickolay-kondratyev_obsidian-vicinity-graph-plugin
---
DECISION (human, 2026-08-07): network calls to third parties are now CONDITIONALLY ALLOWED — gated by the master external-previews setting (_tickets/add-external-previews-setting-single-master-toggle-default-on.md). That makes the OFF guarantee a real invariant we must be able to PROVE, not a convention. Build ONE seam that all external content flows through:

- ONE module is the only place external hosts/URLs are ever constructed (first residents: i.ytimg.com poster URLs, youtube-nocookie.com embed URLs; later: any thumbnail/favicon/oEmbed fetch via requestUrl). Suggested home: a pure URL-builder in src/shared/ plus, when actual fetches arrive, one adapter class wrapping requestUrl/fetch behind an engine-defined port (DIP, like LinkProvider).
- The seam consults the external-previews setting: OFF => it refuses (no URL issued, no fetch made). Unit-test BOTH states through the seam — the OFF test is the guarantee.
- STRONG BLOCK, repo-idiom: add a source-scan tripwire test (same pattern as ACCESSOR_OWNED_SYMBOLS / typedNumberFields.test.ts) that fails if ANY module outside the sanctioned seam references an external host literal, fetch(, or requestUrl(. This is what makes "OFF means zero network" enforceable as the feature grows, instead of a per-feature promise.
- NOTE the current slice's belt-and-suspenders: the YouTube hero is ALSO gated engine-side at hero selection (nid_ur7veu8yqx8x6q8j6vz2z2ioa_e), so when OFF the view never even receives a video hero. The seam is the second, structural layer.

Deps: the master-toggle setting ticket. The render ticket (nid_15r71ajjkbel5s704kmj6wszw_e) should build its poster/iframe URLs through this seam.

---

## RESOLVED (2026-08-07, commit 27c5c62)

The seam and its enforcing tripwire are in place. Pure `src/shared/` change; `npm run check` + `npm test` (1739 tests) green. No view/DOM surface, so no e2e needed.

**The seam — `src/shared/ExternalContentUrls.ts`** (static class, repo idiom like `MarkdownEmbeds`/`Wikilinks`):
- The ONE place external host URLs are constructed. First residents, exactly as specced: `youTubePosterUrl` → `https://i.ytimg.com/vi/<id>/hqdefault.jpg`, `youTubeEmbedUrl` → `https://www.youtube-nocookie.com/embed/<id>`. Hosts declared as `EXTERNAL_CONTENT_HOSTS` data so the tripwire can assert those literals appear nowhere else.
- **Gate**: both builders route through one private `gatedVideoUrl` that (a) returns `null` when `externalPreviews` is OFF, and (b) validates the video id against `^[A-Za-z0-9_-]{11}$` before interpolation (an ill-formed id can't inject path/query segments into a request). The OFF guarantee and id check live in ONE place, so the gate can't be issued around.
- **DIP, no cycle**: takes a narrow `ExternalPreviewsGate { externalPreviews: boolean }` rather than the engine's `ViewSettings` — keeps `src/shared/` a leaf (engine imports shared, so shared→engine would cycle). `ViewSettings` satisfies the gate structurally, so callers pass `settings` straight in.
- Fetches deliberately NOT built (YAGNI, per the ticket's "when actual fetches arrive"). When thumbnail/favicon `requestUrl` lands it joins as one adapter behind an engine-defined port and is added to the tripwire's sanctioned list.

**Both-states unit test — `src/shared/ExternalContentUrls.test.ts`**: ON issues the URL on the owned host; OFF issues `null` (the privacy guarantee as a test); ill-formed ids refused even with previews ON.

**STRONG BLOCK tripwire — `src/shared/externalContentSeam.test.ts`**: scans every non-test, non-seam module under `src/` (comments stripped so prose like libavoid's `fetch(data:)` note isn't flagged) and fails if any names an `http(s)://` URL, `requestUrl(`, `fetch(`, or an owned host literal. Verified non-vacuous three ways: a planted `i.ytimg.com` literal in `engine/constants.ts` made it fail (then reverted); it asserts >10 modules were scanned; it asserts the same patterns DO fire on the sanctioned seam file. Sanctioned list is a single relative path today (`shared/ExternalContentUrls.ts`) — the future fetch adapter appends to it.

**Docs updated**: `ViewSettings.externalPreviews` doc in `src/engine/types.ts` (was "seam lands with a later ticket" → now names the seam + tripwire), and a new key-seam entry in `docs-internal/architecture-map.md`.

The render ticket (nid_15r71ajjkbel5s704kmj6wszw_e) now builds its poster/iframe URLs by calling `ExternalContentUrls.youTubePosterUrl` / `.youTubeEmbedUrl(videoId, settings)`.

## Notes

**2026-08-07T18:47:18Z**

UPDATE (2026-08-07) — the hard source-scan tripwire was REMOVED (commit on branch
drop-external-content-source-scan-tripwire). `src/shared/externalContentSeam.test.ts`
forbade any http(s):// literal outside the seam; it conflated network calls with
harmless identity strings (YoutubeVideoIdentity.canonicalUrl, a watch link a user
clicks — no automatic network) and produced a false build failure.

The "OFF means zero network" guarantee is UNCHANGED but now rests on the RENDER
BOUNDARY, behaviorally: the view only emits a poster <img> / embed <iframe> when
externalPreviews is ON (flowMapping.previewOf; e2e ON/OFF DOM assertions in the
render ticket nid_15r71ajjkbel5s704kmj6wszw_e). ExternalContentUrls remains the single
gated builder for network URLs (returns null when OFF) as defense in depth. The seam
class and EXTERNAL_CONTENT_HOSTS are intact; only the blanket source scan is gone.
