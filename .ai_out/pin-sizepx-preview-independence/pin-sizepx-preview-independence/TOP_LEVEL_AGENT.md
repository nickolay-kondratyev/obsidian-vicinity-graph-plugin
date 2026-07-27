# TOP_LEVEL_AGENT — pin sizePx-independence invariant

Ticket: `nid_f8csd65emmy6p62ad9x5w1psz_e` — Pin the sizePx-independence invariant where
`sizePx` is computed (node preview must not resize a node).

Branch: `pin-sizepx-preview-independence` (from `main`).

## Flow (straightforward)

- [x] EXPLORATION
- [ ] IMPLEMENTATION_WITH_SELF_PLAN
- [ ] IMPLEMENTATION_REVIEW
- [ ] IMPLEMENTATION_ITERATION
- [ ] change_log entry + ticket close + merge to `main`

## Notes

Acceptance: a NodeSizer-suite test composing the same node under all three
`nodePreviewPreference` values, asserting identical `sizePx`. Must NOT live in
`src/view/GraphStructureDiff.test.ts`.
