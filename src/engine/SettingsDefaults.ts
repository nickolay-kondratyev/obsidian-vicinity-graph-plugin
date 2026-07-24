/**
 * DISCOVERABILITY SHIM — NOT the source of truth.
 *
 * Every settings default AND limit lives in {@link SETTINGS_SPEC}
 * (`SettingsSpec.ts`). This file exists purely so that a reader grepping for
 * "SettingsDefaults" lands on the real spec. Prefer importing `SETTINGS_SPEC`
 * (or the derived `EngineDefaults` / `FORCE_LAYOUT_RANGES` adapters) directly.
 */

import { SETTINGS_SPEC } from "./SettingsSpec";

export { SETTINGS_SPEC } from "./SettingsSpec";

/** Navigation handle onto the real spec — see the file doc above. */
export class SettingsDefaults {
	private constructor() {
		// Non-instantiable: this is a discoverability pointer, not a value type.
	}

	/** The single source of truth for every settings default & bound. */
	static readonly SPEC = SETTINGS_SPEC;
}
