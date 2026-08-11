---
id: nid_nioldkusdrwc7fqzr4bmq2bow_e
title: "ESLint run-as-warnings rollout + gate npx eslint src in check/build"
status: open
deps: [nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e]
links: [nid_qjuqgqfwentq2l59o5ya17vra_e, nid_tbqtxmq5gyjr9ehrpk87bcje6_e, nid_6q26wh2r8ivgbeedpf17t31ry_e, nid_uyj3is3eyv9o3ctkv2meqcin7_e, nid_h2hs9s7uvugweohv076dvddpm_e, nid_l17hhil9b22jas1lwvyfgxp5w_e, nid_zs2aog8b2i9e3wutsorjm88ft_e, nid_icr9gp534nm6kgkbc8rgcpu68_e]
created_iso: 2026-08-11T21:27:04Z
status_updated_iso: 2026-08-11T21:27:04Z
type: chore
priority: 2
assignee: CC_WITH-nickolaykondratyev
tags: [lint, release]
---

After the src/ obsidianmd findings are fixed, make lint non-regressing without blocking day-to-day work (parent: nid_qjuqgqfwentq2l59o5ya17vra_e).

1. Fix `npm run lint`: today it is `eslint src e2e` and EXITS 2 ("No files matching the pattern e2e") when the e2e submodule is not checked out — the normal state. Point the default script at `src` only (e2e is a submodule, separate from the score-card check), or guard for an absent e2e dir.
2. Downgrade remaining `obsidianmd/*` (and any accepted `typescript-eslint`) findings to `warn` on src/ in eslint.config.mjs so the pass is green-able.
3. Fold `npx eslint src` (or `npm run lint`) into `npm run check` / `npm run build` so new violations are surfaced but, as warnings, do not hard-fail the build — mirrors the ticket ask "start running the es lint as warnings".
4. Keep e2e/ OUT of the gated path.

Verify: `npm run check` runs lint and passes on a clean tree; a freshly introduced obsidianmd violation shows as a warning.

