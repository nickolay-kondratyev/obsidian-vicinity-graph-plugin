import { SETTINGS_SPEC } from "./SettingsSpec";

/**
 * The AI model slug as it is STORED (task 4/4 `nid_80xc6z8umlpo1x6u4p1v7eb22_e`):
 * trimmed, because a stray space would make OpenAI answer "unknown model"; and a
 * blank slug names no model at all, so it settles back at the spec default rather
 * than turning auto mode into a guaranteed failure. ONE rule, shared by the write
 * path (the settings accessor) and the load path (`persistedShapes`).
 */
export function settledAiModel(raw: string): string {
	const trimmed = raw.trim();
	return trimmed.length === 0 ? SETTINGS_SPEC.relationships.model.default : trimmed;
}
