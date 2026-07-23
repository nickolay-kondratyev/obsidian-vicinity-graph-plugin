# DOC_FIXER — edge-routing__04 (boundary pins)

## Files changed

- `docs-internal/CHANGELOG.md` — new dated entry: group-box boundary pins (group-only,
  perf-driven), detour-ratio telemetry, telemetry-ordering fix, perf held (137ms vs
  ~1464ms), 664/664 tests.
- `_tickets/edge-routing04-...boundary-pins.md` — `status: open → closed` (matches the
  edge-routing sibling vocabulary), `status_updated_iso → 2026-07-23T20:45:00Z`, appended
  a `## Resolution` section (plan content preserved).

## Deliberately skipped

- `docs-internal/plan/high-level-plan.md` — predates the edge-routing epic; its edge
  section covers arrowheads/direction/collapse, NOT libavoid routing endpoint attachment.
  No STABLE-knowledge line to update. Skipped.
- `README.md` — no user-facing edge-routing content (routing is an internal-quality
  behaviour, not a settings-model surface). Skipped.
- `CLAUDE.md` / `docs-internal/architecture-map.md` — no documented invariant changed.
  The `kind` field on `RoutingObstacle` and the boundary-pin scheme are internal details
  below the altitude these files document (architecture-map's libavoid line stays valid).
  Skipped.

## Notes

- Status value chosen: `closed` (edge-routing__00–03 siblings all use `closed`; task's
  `done` fallback was for the unsure case).
- No src/ or test edits; no git commit; `change_log` tool not run.
