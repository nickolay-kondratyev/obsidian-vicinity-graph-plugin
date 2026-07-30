# Exploration — role-internal notes

## Method
Read CLAUDE.md + full ticket first. Then: `find`/`grep` sweeps for every symbol named in
the task (SETTINGS_SPEC, DepthSettings, DIRECTION_DEPTH_FIELD, LinkProvider, obsidianPorts,
ReferenceOrder, Wikilinks/MarkdownInlineLinks, Canvas*, EdgeVisibility), then full-file
`Read` of every hit that mattered, batched 2-5 per turn. No file edits made (read-only role
honored throughout — only Bash reads/greps/finds and Read tool used).

## Confidence / residual risk
- High confidence on all "file exists at line X" and "test exists at path Y" claims — these
  were read directly, not inferred.
- Medium confidence on the settingsResetPlan.test.ts / persistedShapes.test.ts full-literal
  assertions actually needing edits — I saw the literal fixtures exist but did not read
  every assertion in those files end-to-end to confirm each one is a FULL DepthSettings
  object vs a partial merge; flagged this honestly in the public doc rather than overclaiming.
- Did NOT read `docs-internal/notes/settings.md` (the "overarching context" doc the ticket
  points to for standing owner decisions) — the ticket body already inlines every decision
  needed (D1-D5, scope cut, measurement mandate), so I judged this out of critical path given
  effort constraints. If the implementer needs the settings-cleanup CHAIN context (steps
  1-6), that file is the place to look; I did not verify what step 6 refers to beyond what's
  already quoted in the ticket.
- Did NOT read `EdgeAccumulator.ts`, `EdgeCounts.ts`, `NodeEligibility.ts`,
  `PathExclusionMatcher.ts` in full — inferred their role from `VicinityTraversal.ts`'s
  imports and call sites, which was sufficient for the traversal-mechanics questions asked
  (§3) but a deeper dive into `EdgeCounts`'s consumption of `DirectedLink`/`GraphEdge.count`
  would sharpen §3's multiplicity discussion if the implementer needs it.
- Did NOT open `VicinityEngine.ts`/`GraphRequestAssembler.ts` in full (only grepped for
  Depth-related lines) — these just thread `DepthSettings`/`TraversalRoot` through, no
  direction/channel branching found in the grep, so I judged full reads low-value for this
  task's questions.
- Did NOT read `.ai_out/settings-cleanup-descriptor-model/...` or
  `.ai_out/settings-global-only/...` prior-agent output dirs found via `find` — these are
  OTHER roles' prior artifacts for the two prerequisite tickets (nid_wimjq4ewgbg21n4zx9d4qq3a0_e
  descriptor-model, nid_ez38gf1mrdgh5kxedzrdicwzl_e per-doc removal). I confirmed their
  *effects* are landed by reading the current source directly (SettingsSpec.ts guards exist;
  types.ts says "GLOBAL-only: there is no per-doc override layer"), which is stronger evidence
  than reading another agent's plan doc. Flagging their existence in case the orchestrator
  wants that provenance.
- `docs-internal/RELEASE_CHECKLIST.md` was NOT opened — only referenced from the ticket as a
  place a release-note line is required. Confirm its current content before claiming "not
  present" too strongly in a downstream ticket; I only said "not yet present" based on absence
  of any grep hit for depth-rename language, not a full read.

## Notable staleness beyond what the ticket itself already flagged
The ticket's own "SCOPE CHANGE" note (bottom, 2026-07-29T22:11:13Z) already correctly
self-identifies that per-doc/per-central saved state is gone. What I additionally verified
and the ticket does NOT explicitly say: **`EdgeVisibility.ts` referenced in the ORIGINAL
research findings (§5, §7) no longer exists at all** — not just "the per-doc angle is gone"
but the whole file/feature was deleted by an unnamed "previous ticket" (per SettingsSpec.ts's
own comment). This is worth surfacing prominently to whoever plans Stage 3 tickets so they
don't accidentally scope in "make EdgeVisibility channel-aware" work against a file that isn't
there — I made this §7 in the public doc precisely to make it loud.

## Possible follow-up the orchestrator may want
- The `CentralDepthControls.tsx` file the ticket cites (`:29-36`) is confirmed gone (find
  returned zero hits) — consistent with the per-central removal, already correctly
  anticipated by the ticket's own scope-change note. No surprise there, just confirming.
- Worth a quick `grep -rn "channel\|Channel" src/engine src/view` before implementation
  starts, in case a naming collision already exists (React's own "channel" vocabulary, etc.)
  — I did not run this check.
