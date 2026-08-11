// Shipped code schedules timers through `window.*` (the obsidianmd/prefer-window-timers
// contract): real Obsidian is an Electron renderer where `window` is always the global.
// Our node-env suites have no `window`, so a low-level primitive like `ChunkedWork.sleepZero`
// (`window.setTimeout`) would throw the moment any node-env test walked it. Point `window`
// at `globalThis` when the environment has none — jsdom suites already own a real `window`,
// so the guard leaves them untouched. This is the ONE choke point for that seam; node-env
// tests never need to stub `window` per-file.
if (typeof (globalThis as { window?: unknown }).window === "undefined") {
	(globalThis as { window: typeof globalThis }).window = globalThis;
}
