# IMPLEMENTATION_REVIEWER_PART1__PRIVATE

Working notes for a future reviewer of this branch. Not a deliverable.

## How I verified (so a re-review can skip re-deriving)

- Ran `npm test` + `npm run check` myself into `.tmp/review_test.log` /
  `.tmp/review_check.log`. 787/3 and clean respectively; the 3 are the known
  `collidePaddingPx` baselines from `22bd5cb`.
- Confirmed non-tampering with those 3 by diff shape, not by trust:
  `SettingsSpec.test.ts` has additions only; `forceLayoutSettings.test.ts` is not
  in the diff.
- Test-deletion sweep: `git diff main...HEAD -- '*.test.ts' '*.test.tsx' | grep -E '^-' | grep -v '^---'`
  → three import lines only. This is the single highest-signal check on this repo
  and it came back clean.

## Things I checked that looked like bugs but are not

1. **Frontmatter image suppresses the outline.** Looks aggressive, but
   `FRONTMATTER_REFERENCE_OFFSET = -1` < every heading offset by construction,
   and the plan's D3 case table specifies exactly this. Tested.
2. **Depth filter can empty a non-empty outline → node falls back to the image.**
   I initially wrote this up as a design hole; it is plan D3b, an explicit
   decision, and step 7's `nodePreviewChoice` owns it. Withdrawn.
3. **Stale node data on the `reuse-layout` path.** Checked
   `GraphViewController.ts:200` — `vicinityGraphToFlow` runs on every rebuild;
   only positions/group dimensions are reused. No staleness.
4. **`isMarkdownPath` case sensitivity making the `X.Excalidraw.MD` test
   vacuous.** `VaultPathFacts.extensionOf` lower-cases, so the file *is* markdown
   and the suffix branch is what rejects it. The test is real.
5. **`DEFAULT_OUTLINE_MAX_DEPTH` unused.** Matches the existing `DEFAULT_NODE_CAP`
   / `DEFAULT_OUTGOING_DEPTH` pattern (all are spec-alias constants with no
   non-test production callers). Not a new sin — deliberately not reported.
6. **`FakeObsidianPorts.getFileCache` returning `{}` instead of `null`.** It
   returns `null`; the cache-miss test is distinct from the no-headings test.

## Real findings and how firm I am

- **M1 (dead `orderedLinkTexts`)** — firm. Zero production callers; verified by
  grep across `src/` and `e2e/`. The only nuance worth preserving in the fix is
  the empty-cache case, which has no equivalent in the new tests.
- **m1 (double resolution pass)** — I downgraded this from MAJOR deliberately.
  It *is* a deviation from plan D3's stated single-pass design, but the cost sits
  next to elk + libavoid WASM routing, so calling it MAJOR would be crying wolf.
  If the implementer pushes back, I do not intend to escalate.
- **m2 (unfailable T30)** — flagged by the implementer first; I only confirmed
  it. It is the plan's choice, not the implementer's.

## Judgement on the verdict

CHANGES REQUIRED for a ~10-line dead-code removal is arguably heavy, and I
considered APPROVED WITH MINORS. I chose CHANGES REQUIRED because labelling a
MAJOR finding and then approving would make the severity scale meaningless. The
review states explicitly that steps 6–10 need not wait on it, so the verdict
costs no momentum.

Overall this is unusually disciplined work: required (not optional) fields so the
compiler found the call sites, one commit per plan step, no test weakened, and the
implementer refused to re-pin the unrelated failing baselines and filed a ticket
instead. That refusal is the behaviour we want and is worth saying out loud.
