// Types for the build config's reusable bundle options, imported by the token guard
// test (src/view/libavoidTokenGuard.test.ts). esbuild.config.mjs is plain JS outside
// the tsc `include`, so this ambient declaration is how the test sees `bundleContentOptions`.
declare module "*/esbuild.config.mjs" {
	import type { BuildOptions } from "esbuild";
	/** Production/dev esbuild options for the shipped bundle, sans the file-writing plugins. */
	export function bundleContentOptions(prod: boolean): BuildOptions & { plugins: NonNullable<BuildOptions["plugins"]> };
}
