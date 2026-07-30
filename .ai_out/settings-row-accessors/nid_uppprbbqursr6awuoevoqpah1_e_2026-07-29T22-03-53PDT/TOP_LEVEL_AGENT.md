# TOP_LEVEL_AGENT — settings-row-accessors

Ticket: nid_uppprbbqursr6awuoevoqpah1_e — move per-control-kind {value read, range, interaction}
into the row model so the two settings presenters are pure markup.

Dep nid_armoson86j0ii8c33r1odo1rc_e: CLOSED. Start tree: clean.

Flow: IMPLEMENTATION_WITH_SELF_PLAN → IMPLEMENTATION_REVIEW → IMPLEMENTATION_ITERATION.

## Log
- [1] Spawned IMPLEMENTATION_WITH_SELF_PLAN (background). Told to settle the
  "where does the accessor live" design question explicitly, kill the duplicated
  step constants, keep the tripwire suites honest, run npm test + npm run check,
  and commit on the current branch.
