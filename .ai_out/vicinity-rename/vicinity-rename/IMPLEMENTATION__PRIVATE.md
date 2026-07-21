# IMPLEMENTATION — private state

Status: **COMPLETE.** All gates green. Working tree holds the migration; not committed.

## Done
- Wrote `.tmp/vicinity-rename/rename.py` (untracked throwaway). Ordered literal replace +
  `git mv`. Idempotent.
- Pass 1: 72 files content-changed. Pass 2: 12 `git mv`.
- Descriptions rewritten in manifest.json + package.json (local graph + nearby notes; no
  neighboring).
- RELEASE_CHECKLIST.md:43 bullet marked done + reworded (avoids literal `neighborhood`).
- npm ci run (node_modules was absent).

## Verified
- tsc: 0. vitest root: 52/559 (== pre-rename baseline). sublib: 6/69. e2e tsc: 0.
- AC1 0, AC2 0, AC3 57 neighbor hits kept, AC4 identity ok, AC5 descriptions ok.

## Gotcha for any re-run / next iteration
- Do NOT write the literal `neighborhood` in any tracked prose — it fails AC1. When
  describing the rename in docs, use "the vicinity rename" phrasing, not the old slug.
- rename.py is under `.tmp/` (untracked) — must stay out of the commit.
- If re-running the script: it's a no-op on already-migrated tree (write-only-on-change,
  git mv skipped when source gone / target present).

## Not mine
- Final CHANGELOG entry + the commit → TOP_LEVEL_AGENT.
