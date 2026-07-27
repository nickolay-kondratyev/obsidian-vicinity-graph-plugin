# Implementation review — canvas markdown-style links (`nid_ygo7h95ssgmunaqsprc1zlmfh_e`)

Branch `fix/canvas-markdown-style-links` @ `977d029` vs `main`. Reviewer ran everything below itself.

## Summary

Canvas TEXT nodes now yield edges for markdown-style inline links (`[label](note.md)`,
`![alt](pic.png)`) in the `fallback-required` regime, matching what core reports in the
`core-indexed` regime. New pure module `src/shared/MarkdownInlineLinks.ts` owns the syntax;
`CanvasFallbackParser.textNodeReferencesOf` runs both scans and maps both to the existing
`text-node-link` kind; resolution stays on the single `getFirstLinkpathDest` seam in
`ObsidianLinkProvider`. Docs (plan doc, `Wikilinks.ts` header, README) updated; the code-span
residual re-homed to a new ticket `nid_869bt9d9rlrbr8of1403dnmf3_e`.

Overall: **good, tight, honest work.** The design decision (normalise to link text, one
resolver, no new `CanvasReference` kind) is the right call and is well argued in code
comments. Layering, SRP and DRY are clean. Acceptance criteria are met. Two things worth
fixing/deciding before this is called finished, neither blocking.

### Verification (run independently, not taken on trust)
- `npm test` → **exit 0**, 82 files / 1137 tests pass (`.tmp/rev-test.log`).
- `npm run check` → **exit 0** (`.tmp/rev-check.log`).
- Matcher behaviour independently probed against ~35 adversarial inputs (`.tmp/probe.mjs`),
  not merely read.

### Acceptance criteria
- Parity in both regimes for `[label](note-b.md)` — covered in `ObsidianLinkProvider.test.ts`
  (outgoing + backlink + core-indexed side). ✔
- `[a](my%20note.md)` resolves; `[a](https://example.com)` yields no edge. ✔
- Order of operations claim **verified in code and by probe**: unwrap `<…>` / drop trailing
  title → external verdict → strip `#`/`?` → `decodeURIComponent` (try/catch) → trim. The
  `%3A`/`%23` tests are real regression guards for that order, not decoration. ✔
- No behaviour-capturing test removed. The only touched pre-existing test is a NAME correction
  ("no wikilink" → "no link of either syntax") with identical assertion. ✔
- `src/shared/` purity intact — `src/engine/importGuard.test.ts` guards `src/shared` too, and
  the new module imports nothing. ✔

## 🚨 CRITICAL Issues

None.

## ⚠️ IMPORTANT Issues

### 1. SHOULD-FIX — the premise "core indexes these" is asserted, never observed, and no test can falsify it

The whole change is predicated on: real Obsidian, in the `core-indexed` regime, reports
`[label](note.md)` written in a canvas TEXT node in `metadataCache.resolvedLinks`, keyed by
the resolved (decoded) path. That claim comes from the ticket text; nothing in this branch
verifies it. The parity block's core-indexed test hand-seeds
`resolvedLinks: { "board.canvas": { "note-b.md": 1 } }` — i.e. the "core" side of the parity
is a fixture the implementer wrote, so if the premise is wrong the test still passes.

Failure scenario if the premise is wrong: this change does not close a divergence, it
*creates* the mirror-image one — the fallback regime emits edges core never emits, and the
user again sees "the graph depends on how fast you opened it", now in the other direction,
with the plan doc now asserting the opposite as settled semantics.

Concrete ask: a five-minute devtools check in the real-Obsidian harness (the methodology is
already written down in `.ai_out/canvas-link-regime-unify/EXPLORATION_E2E_PUBLIC.md`) —
write a canvas text node with `[label](note.md)` and `[a](my%20note.md)`, read
`app.metadataCache.resolvedLinks["board.canvas"]`. Record the observed shape in the plan doc
(it is the only anchor for the parity fixture). If that is out of scope for this task, file
it as a ticket rather than leaving the assumption undocumented — right now the plan doc reads
as though it were measured.

### 2. SHOULD-FIX — an unencoded space truncates the destination and can manufacture a phantom edge

`destinationOf` drops everything from the first whitespace, on the assumption that whatever
follows is a `"title"`. For `[a](my note.md)` that yields the target **`my`**.

Failure scenario: a vault containing a note literally named `my` (or, more plausibly with
real filenames, `[a](Meeting notes 2026.md)` → target `Meeting`, and a note `Meeting` exists)
gets an edge to the *wrong document* — a phantom edge, exactly the class of bug the new
code-span ticket exists to track. Obsidian/CommonMark would produce no link at all here.

Concrete fix: only treat the whitespace suffix as a title when the remainder actually starts
a title (`"`, `'` or `(`); otherwise the destination has an unencoded space and names nothing
resolvable — return `""`. Roughly:

```ts
const TITLE_START = /^\s+["'(]/;
// …in destinationOf: if (terminator !== -1 && !TITLE_START.test(parenthetical.slice(terminator))) return "";
```

Plus one BDD test: `WHEN a destination carries an unencoded space THEN it names no document`.
This is strictly safer than the current silent truncation and stays well short of a parser.

## 💡 Suggestions

### 3. NICE-TO-HAVE — escaped brackets over-match
`escaped \[not a link\](x.md)` yields `x.md`; core yields nothing. Same family as the code-span
residual and just as rare. Not worth code, but the module header lists "brackets inside the
label" and "parens inside the destination" as known non-handled — add "escaped brackets" to
that list so the header is exhaustive about where it over-matches, not only where it
under-matches.

### 4. NICE-TO-HAVE — path-shaped destinations go into `getFirstLinkpathDest` verbatim
`[a](./sub/b.md)`, `[a](../b.md)` and `[a](/abs/b.md)` pass through unchanged. Whether
`getFirstLinkpathDest` normalises `./` / `../` / a leading `/` is unverified here; if it does
not, those links resolve in core and not in the fallback. Fold this into the verification in
finding 1 (same devtools session) and note the answer in the module header.

### 5. Positives worth keeping
- Separate sibling module rather than growing `Wikilinks` — correct SRP call; the two syntaxes
  share no rules beyond "produces link text", and the shared thing (the resolver) is already
  shared in exactly one place.
- `globalPattern()` returning a fresh `/g` regex, with the `lastIndex`-leak regression test,
  mirrors the existing `Wikilinks` convention — consistency over cleverness.
- The `decodeURIComponent` try/catch keeping the literal text is the honest behaviour, and it
  is tested rather than merely commented.
- `textNodeReferencesOf`'s comment states the two-scan ordering consequence instead of hiding
  it; both consumers are genuinely order-insensitive, so the claim holds.

## Documentation Updates Needed

- Plan doc, `Wikilinks.ts` header and README were checked line by line and now state the truth.
  The implementer's claim that the README line **"canvas text-node wikilinks are skipped" was
  already wrong before this change is CORRECT** — `main`'s own plan doc already declared
  text-node wikilinks binding on both paths (ticket `nid_s676x55uojmtcwh9t4l9mc6zl_e`), so the
  README was stale, not newly falsified. Good catch, correctly fixed.
- Code-span divergence: honestly disclosed as growing by one syntax and re-homed to
  `nid_869bt9d9rlrbr8of1403dnmf3_e`, cited from plan doc, README and both matcher headers. No
  scope creep, no silent widening.
- Only doc gap: the plan doc now states the normalisation order as settled semantics without
  recording that it was inferred rather than observed (finding 1).

## Verdict

**READY** — merge-worthy as is. Findings 1 and 2 are real and should be picked up (2 is a
few lines plus a test; 1 is a verification, not code) — either in this branch or as an
explicitly filed follow-up ticket, not dropped.
