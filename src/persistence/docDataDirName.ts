/**
 * Name of the per-doc persistence folder inside the plugin dir
 * (`.obsidian/plugins/<id>/doc-data/`), one `<docid>.json` per doc.
 *
 * ONE source of the literal: the plugin PRODUCES this path (`src/main.ts`) and
 * the e2e harness WIPES it on the throwaway vault copy, so a rename only one
 * side followed would silently stop the wipe and let manual-QA pins leak into
 * e2e runs.
 *
 * Deliberately its own module with NO imports: the node-side e2e process
 * imports it at RUNTIME, so it must stay free of `obsidian`/`react`/DOM.
 */
export const DOC_DATA_DIR_NAME = "doc-data";
