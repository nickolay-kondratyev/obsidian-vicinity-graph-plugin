# Ticket: Deduplicate VIEW_TYPE_VICINITY_GRAPH between src and e2e

**Status:** OPEN
**Origin:** step-05 Phase C review (IMPLEMENTATION_REVIEW_C NIT-2). Phase C forbade
production-code changes, so `e2e/obsidianHarness.ts` carries a WHY-documented copy of
`VIEW_TYPE_VICINITY_GRAPH` instead of importing it (the source module imports
`obsidian`, which the e2e tsconfig cannot resolve).

Fix: move the constant into an obsidian-free module (e.g. `src/view/constants.ts`),
import it from both the production view code and `e2e/obsidianHarness.ts`, and delete
the duplicate in the harness.
