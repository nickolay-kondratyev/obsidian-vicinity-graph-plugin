# PARETO_COMPLEXITY_ANALYSIS__PRIVATE — node-outline

Working notes for the next instance of this role. Not a summary of the public
doc — read that for the findings.

## What I actually did

1. Read `CLARIFICATION__PUBLIC.md` in full (all 4 rounds), then
   `DETAILED_PLANNING__PUBLIC.md` (1140 lines, read in 2 pages) and
   `IMPLEMENTATION_ITERATION_PART2__PUBLIC.md` in full.
   I **skimmed rather than read** `IMPLEMENTATION_PART1/PART2__PUBLIC.md` and
   `IMPLEMENTATION_ITERATION_PART1__PUBLIC.md` — the part-2 iteration doc plus
   the diff carried the disposition history I needed. Low risk, but noted.
2. Read the shipped source directly (not just the diff) for every new module:
   `NodeOutline.tsx`, `node-outline.css`, `outlineTree.ts`, `outlineEntryLabel.ts`,
   `nodePreviewChoice.ts`, `nodeOpenIntent.ts`, `NoteOpenContext.ts`,
   `ObsidianLinkProvider.ts`, `ReferenceOrder.ts`, `FileKinds.ts`, plus the
   diff for every touched file and the full `e2e/nodeOutline.e2e.ts`.
3. Ran `npm test` myself (→ `.tmp/pareto-test.log`) rather than trusting the
   iteration doc's claim. 815/3 confirmed; the 3 are the ticketed
   `collidePaddingPx` baseline failures, unrelated.
4. Ran targeted greps to test each over-engineering hypothesis instead of
   asserting from reading. That is what produced the two dead-code findings —
   both would have been invisible from the diff alone.

## The greps that mattered (rerun these next time)

```bash
grep -rn "orderedMarkdownReferences\|ResolvedReference" src/ | grep -v '\.test\.'
for s in DEFAULT_NODE_CAP DEFAULT_MIN_NODE_PX DEFAULT_OUTGOING_DEPTH DEFAULT_OUTLINE_MAX_DEPTH; do
  echo "$s: $(grep -rn "$s" src/ e2e/ | grep -v 'engine/constants.ts\|engine/index.ts' | wc -l)"; done
grep -n "AUTHORED_CSS_FILES" -A 6 esbuild.config.mjs
```

The `DEFAULT_*` comparison is the trick worth reusing: an unused constant is
only obviously wrong once you show its five siblings all have consumers.

## Judgement calls, and how confident I am

- **`ResolvedReference.offset` is dead** — high confidence (grep-verified, one
  call site, `.map(r => r.path)`). This is the cleanest finding in the report.
- **CSS reveal trap (R3)** — medium-high confidence that my third option is
  better than both the shipped shape and the reviewer's MINOR 3. I deliberately
  agreed with the implementation's *rejection* of MINOR 3 before proposing the
  variant; the implementer's ladder-readability argument is correct and my fix
  preserves it. I raised it as a question rather than a demand because the
  implementation already argued this ground once and a third opinion arriving
  post-hoc should not just overrule.
  Mitigating fact I found and did **not** suppress: `AUTHORED_CSS_FILES` is
  already in alphabetical order, so a "sort the list" edit would not flip it.
  That lowers the risk materially and is why R3 is not `CUT NOW`.
- **The 45-line image-rule trade** — this is the only place I think a real 80%
  option was passed over, and I said so, but I also said I'd keep it. Deliberate:
  the plan's counter-argument (silently blank node on `![[missing.png]]`) is
  sound, and the change improved pre-existing code. Manufacturing a `CUT NOW`
  here would have been the nitpicky failure mode the brief warned against.
- **Plumbing-echo tests (R5)** — I initially wrote them up as vacuous, then
  checked whether they could actually fail. `assemble()` hardcoding `[]` compiles
  fine, so they can. Downgraded to "low-yield, keep". Worth re-doing that check
  before ever calling a test vacuous in this repo.

## What I did NOT verify (be honest about this if asked)

- Did not run `npm run test:e2e` (needs a real Obsidian; ~11 new cases). I took
  the iteration doc's mutation-verification table at face value — it is specific
  enough (per-mutation pass/fail counts) that fabricating it would be odd, and
  the e2e code I read matches what the table describes.
- Did not run `npm run build` / regenerate `styles.css`, so R3's claim that the
  concatenation order is graph-view→node-outline rests on reading
  `esbuild.config.mjs:47-51`, not on inspecting the artifact.
- Did not evaluate visual quality (nesting spacing, entry density at 104px).
  That is `PRINCIPAL_UX_REVIEWER` / the smoke ticket's job, not Pareto's.

## Framing note for whoever reads the verdict

`JUSTIFIED WITH TRIMS` here means "the requirements were expensive, the code is
not". Two of the three trims are dead code (~17 lines total); the third is three
lines moved between stylesheets. If the human reads the verdict as "the feature
was over-built", that is a misread — the honest statement is that the clarified
spec (nested lists, display stripping, a depth slider, a mandated component
boundary) is what set the price, and the implementation paid roughly that price
and no more. I put that sentence in the public doc's verdict paragraph on
purpose.
