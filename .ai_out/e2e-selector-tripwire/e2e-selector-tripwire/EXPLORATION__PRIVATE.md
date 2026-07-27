# Private working notes — e2e selector tripwire exploration

Scratch commands used (repo root), kept here for a future clone of this role to
re-run quickly rather than re-deriving:

```bash
# absence-assertion grep (facts 1)
grep -n "vicinity-graph\|toHaveCount" e2e/vicinityGraph.e2e.ts

# vitest config
cat vitest.config.ts

# prior-art scan tests
cat e2e/vaultTarget.test.ts
cat src/engine/importGuard.test.ts

# all vicinity-graph tokens referenced anywhere under e2e/ (any .ts, not just .e2e.ts)
grep -rhoE '\.vicinity-graph-[A-Za-z0-9_-]+' e2e --include=*.ts | sort -u > .tmp/e2e_classes.txt

# all vicinity-graph tokens produced under src/view — THE GOTCHA: className="foo"
# and cls: "foo" literals have NO leading dot; only CSS rules (.foo { }) do.
# First pass (WRONG — requires leading dot on both sides) produced 3 false
# "missing" results: vicinity-graph-attachment__count, vicinity-graph-sizing,
# vicinity-graph-node__breadcrumb. Manually grepped each and found the first
# two ARE present as bare className/cls literals (NoteNode.tsx:186,
# SizingSection.tsx:41) — the dot-stripping was the bug, not a real gap.
grep -rhoE 'vicinity-graph-[A-Za-z0-9_-]+' src/view --include=*.tsx --include=*.ts --include=*.css | sort -u > .tmp/src_tokens.txt
sed 's/^\.//' .tmp/e2e_classes.txt | sort -u > .tmp/e2e_tokens.txt
comm -23 .tmp/e2e_tokens.txt .tmp/src_tokens.txt
# => only vicinity-graph-node__breadcrumb remains, confirmed exempt (absence assertion)

# helper-file selector centralization check
grep -rn "vicinity-graph" e2e/*.ts | grep -v "\.e2e\.ts:"
# => obsidianHarness.ts, settingsBaseline.ts (comments only), settingsTabPage.ts, vaultTarget.test.ts (PLUGIN_ID string, not a CSS class)

# interpolated-class-name check (would defeat static regex scan) — zero hits, good
grep -n 'vicinity-graph-\${' -r e2e

# getByTestId usage — zero hits, confirms class-only targeting
grep -n "getByTestId\|data-testid" -r e2e

# typecheck scope
cat package.json | grep -n "check\|test:e2e"
cat e2e/tsconfig.json
```

## Things I did NOT fully verify (flag for reviewer / next explorer)

- Did not line-by-line re-confirm EVERY absence-assertion line number the prior
  explorer listed (e.g. `nodeOutline.e2e.ts:114,274`) — spot-checked the pattern
  (`toHaveCount(0)` same-line as `.locator(...)`) holds broadly via the full
  grep dump in the public doc's section (b)/(c), but did not open every single
  cited line individually.
- Did not do a full CSS-vs-JSX symmetry audit of all 76 `src/view` tokens
  (i.e. whether every CSS rule has a matching JSX/cls producer and vice versa)
  — only cross-checked the ~39 tokens actually referenced from `e2e/**`, since
  that's the only set relevant to the tripwire's correctness.
- `settingsBaseline.ts` mentions of `.vicinity-graph-disclosure*` are in DOC
  COMMENTS only (verified via the grep dump — lines 85, 90, 106 are all inside
  `/** ... */` blocks), not live selector strings — worth double-checking if
  the implementer's regex naively scans block comments too (it would false-
  negative in the SAFE direction: comments in a NON-`.e2e.ts` file wouldn't be
  scanned anyway under the literal task scope).
- The task scope says "asserted under `e2e/**/*.e2e.ts`" literally — I flagged
  in section (b) of the public doc that `obsidianHarness.ts`/`settingsTabPage.ts`
  are `.ts` helpers, not `.e2e.ts`, and currently every class they reference is
  ALSO redundantly present in some `*.e2e.ts` file, so scoping strictly to
  `*.e2e.ts` doesn't lose coverage TODAY, but is a latent gap the implementation
  agent should explicitly decide on (scan `e2e/**/*.e2e.ts` only, per literal
  task wording, vs. `e2e/**/*.ts` minus `*.test.ts` to also catch helpers) —
  this is a design decision for IMPLEMENTATION, not something I resolved.
