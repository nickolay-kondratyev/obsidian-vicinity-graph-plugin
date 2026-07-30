# Stage 3 reviewer — private notes

## How I actually verified things (so a re-review doesn't redo it)

- Ran `npm test` (1212/91, exit 0) and `npm run check` (exit 0) myself before
  reading any prose. Logs in `.tmp/rev3_test.log`, `.tmp/rev3_check.log`.
- Read the six commits as diffs. The measured commit `21b3152` I read in full,
  file by file, and re-derived the file counts by hand from `--stat`.

## D1 — the one thing I was told to be hardest on

The implementer is right and I proved it from first principles rather than
trusting the test: kind-pure channel results = paths that are homogeneous end to
end; kind-blind = all paths. Those coincide iff D ≤ 1 because a kind change needs
2 hops. New ⊆ old always (never a superset), so "strictly smaller at D=2" is
exactly right.

Notably this makes the *ticket's* D1 rationale wrong but its *conclusion* (ship
6a) still correct, because the shipped default is 1. I said so plainly rather
than letting the correction read as though the decision were in doubt — the
brief said decisions are settled and I should judge fidelity.

The correction is propagated to 6 places (spec comment, plan, README, release
checklist, commit msg, 2 test docblocks). I grepped for the old wrong phrasing;
nothing survives. That is unusually thorough and I said so.

## Where I pushed back

The two findings I care about most and would not drop:

1. **The equivalence test is vacuous w.r.t. depth.** The suite advertises itself
   as spec-tracking ("read from `EngineDefaults`, not a literal") but the fixture
   has no 2-hop chain, so it cannot fail if the default rises. That is precisely
   the "test that looks like it guards something it doesn't" pattern CLAUDE.md
   calls a lie-adjacent smell. It is a 2-line fixture change. I did not soften it.
2. **The measurement table doesn't add up.** 4+1+1+2+13 = 21 against a headline
   of 25; actual fixture churn is 17 (13 unit + 4 e2e), and the commit message
   says 18 — three different numbers for one quantity. On any other ticket this
   is a nit. On *the measurement ticket* it is the deliverable, so I ranked it
   SHOULD-FIX and led the measurement section with it.

Note the direction of the error is self-flattering in the table (fewer churned
files), even though the honest headline (25) is right in front of it. I judged
this as sloppiness, not spin — the headline and every load-bearing claim are
accurate, and the caveats section actively argues *against* the write-up's own
conclusion. So I called the measurement trustworthy-after-fix rather than
suspect.

## What I deliberately did NOT flag

- The kind-pure gap itself. Settled (D1/6a), brief says don't re-litigate.
- `getLinkCount` / node sizing staying kind-blind → NIT only. It is a Stage-2
  concern, was disclosed in Stage 1 with reason, and the traversal genuinely
  never calls `getLinkCount`.
- `EdgeVisibility`'s induced sweep, which the ticket's §5 worries about — that
  module no longer exists (edge visibility was hardcoded to
  `walked-from-center` by an earlier cleanup ticket), so the concern is moot. I
  checked `ls src/engine/` rather than assuming.
- Backticks in the new row description: there is precedent (exclusion patterns
  row), so it's consistency, not a defect. Nitpick avoided.
- `persistedShapes.test.ts` round-trip weakening → NIT, because
  `settingsSpecPersistence.test.ts` proves non-default round-trip for every leaf
  structurally. I checked that suite before downgrading.

## Residual risk I'm accepting

`npm run test:e2e` needs a real Obsidian and did not run. The new "Embeds out"
row's actual *rendering* in both surfaces is guaranteed only by a source scan.
That is the repo's known, ticketed limitation, not this change's regression — but
if the human smoke-runs anything before release, it should be: open the settings
tab and the in-graph panel, confirm three depth steppers in the declared order,
and confirm a stale `data.json` with `outgoingDepth` comes back at 1/1/1 rather
than erroring.
