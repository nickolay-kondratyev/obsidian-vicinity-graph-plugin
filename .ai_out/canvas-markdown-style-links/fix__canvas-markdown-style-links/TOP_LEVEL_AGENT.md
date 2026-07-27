# TOP_LEVEL_AGENT — canvas text-node markdown-style links

Ticket: `nid_ygo7h95ssgmunaqsprc1zlmfh_e` (follow-up to `nid_s676x55uojmtcwh9t4l9mc6zl_e`).
Branch: `fix/canvas-markdown-style-links` (from `main` @ d6c4824).

Prior art (read, do not duplicate): `.ai_out/canvas-link-regime-unify/`.

## Goal

Close the residual regime gap: a canvas TEXT node containing a markdown-style
inline link `[label](note.md)` must produce the same edge in the fallback regime
as core's `resolvedLinks` already produces in the `core-indexed` regime.
Encoded targets (`%20`) resolve; external URLs produce no edge.

## Flow

| Phase | Status |
|---|---|
| EXPLORATION | spawned |
| IMPLEMENTATION_WITH_SELF_PLAN | pending |
| IMPLEMENTATION_REVIEW | pending |
| IMPLEMENTATION_ITERATION | pending |
