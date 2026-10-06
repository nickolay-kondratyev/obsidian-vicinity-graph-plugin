---
id: nid_cbnhpdfn4myqfzqr8weyg7kq5_e
title: "Relationships 3/4: AI relationship generator core (OpenAI via env key, eligibility, prompt, capped queue)"
status: open
deps: [nid_a5m4kforr9scit68rhqmqh78o_e]
links: []
created_iso: 2026-10-06T23:04:40Z
status_updated_iso: 2026-10-06T23:04:40Z
type: task
priority: 2
assignee: nickolaykondratyev
parent: nid_fc47gtxej6z7fqc53bflme8p5_e
tags: [relationships]
---

Part 3/4 of the named-relationships epic. Read the parent ticket first ("AI mode" holds the human
decisions this ticket implements).

## Goal
The AI relationship namer, fully testable behind fakes. The UI toggle and key picker come in task 4/4.

## Pieces
- `RelationshipNamer` port (engine-defined, async) + `OpenAiRelationshipNamer` adapter:
  - HTTP via Obsidian `requestUrl`: CORS-free, and it keeps the `fetch(` token out of the bundle
    (`src/view/libavoidTokenGuard.test.ts`).
  - `POST https://api.openai.com/v1/responses` with `{ model, instructions, input,
    reasoning: { effort }, text: { format: { type: "json_schema", name, strict: true, schema } } }`.
    The schema is `{ name: string }`, `additionalProperties: false`.
  - Defaults: model `gpt-6-luna`, effort `medium` (named constants). Effort values the model page
    lists: none, low, medium, high, xhigh, max. The generic API reference lists only low/medium/high, so
    verify `max`/`xhigh` with one live call before offering them.
  - Response: find the `output[]` item with `type == "message"` (reasoning items may come first) →
    `content[]` `output_text.text` (JSON) or `refusal`. Usage comes from `usage.input_tokens` /
    `usage.output_tokens`.
  - The key comes from a `ApiKeySource` seam, resolved at call time: the SecretStorage secret named in
    settings (`app.secretStorage.getSecret(name)`) if set, else `process.env.OPENAI_API_KEY`. The key is
    NEVER logged, stored by us, or put in an error.
  - Errors are mapped to plain-language copy that says how to fix them, never raw codes alone:
    - no key: "pick a key in settings, or start Obsidian from a terminal with OPENAI_API_KEY set — apps
      started from the desktop don't see shell variables";
    - 401 bad key;
    - 404 unknown model;
    - 429 rate limit/quota;
    - network down.
  - `FakeRelationshipNamer` for tests.
- Pure eligibility (`aiEligibility`): a directed LINK edge `A → B` qualifies iff
  - (a) no name of any origin for EXACTLY `A → B` (syntax, manual, ai, dismissed). A `B → A` name does
    NOT block it;
  - (b) both notes have ≥ `MIN_AI_CONTENT_CHARS` (200) of text after stripping frontmatter, link syntax
    and whitespace;
  - (c) neither note is a member of a folder group in the current graph (human decision: a waste
    for now; revisit later);
  - (d) the edge is not a pure folder-hierarchy edge;
  - (e) both are `.md` or `.canvas` (canvas text = its text cards via the existing canvas parser).
- Pure prompt builder (KISS):
  - Include both FULL notes (title + content; the source contains its `[[target]]` link) and the anchor list.
  - Ask for ONE name for `A → B` from A's point of view ("A <name> B"), short kebab-case and SPECIFIC.
    Use an anchor name ONLY when it fits well; any other specific name is equally fine (anchors are
    for consistency, never forced). Avoid vague names (`related`, `related-to`).
  - Ceiling: no truncation. Huge notes cost more. Add a per-note cap only if a real vault hits it
    (gpt-6-luna accepts ~922K input tokens).
  - Anchor list = a named constant (human-approved 2026-10-06; `related-to` dropped as too vague):
    `increases, decreases, causes, prevents, enables, depends-on, supports, contradicts, improves,
    replaces, part-of, example-of, instance-of, defines, explains, extends, uses, references`.
  - The response validator reuses task 2/4's name validation.
- `AiRelationshipQueue`:
  - Dedupes in-flight edges.
  - At most `AI_MAX_REQUESTS_PER_BUILD` = 20 new requests per graph redraw, all allowed concurrently
    (named constant; WHY = cost ceiling).
  - Latest build wins: a newer build drops queued-not-started work.
  - Stops on a fatal error (missing/bad key, unknown model) instead of hammering.
  - Results are written through `RelationshipStore` (origin `ai`, model, effort, usage), and the views
    repaint labels.
- Session counters (named, failed, tokens) for the 4/4 status line.

## Acceptance
- Unit tests with fakes and NO live calls in `npm test`:
  - the eligibility table, including directedness and the grouped-note exclusion;
  - the prompt builder and response parsing (reasoning item first, refusal);
  - error mapping;
  - the queue: dedupe, cap, fatal stop, supersede.
- One focused manual live call, with the cost recorded in the ticket notes.
