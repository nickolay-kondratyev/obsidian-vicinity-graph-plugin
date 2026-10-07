import { SecretComponent } from "obsidian";
import type { App } from "obsidian";
import type { SecretPickerRequest } from "./viewPorts";

/** The focusable elements a `SecretComponent` may render, named for assistive tech below. */
const PICKER_CONTROLS = "button, input, select";

/**
 * Obsidian's own secret picker (`SecretComponent`, since 1.11.4 — below our 1.12.4
 * floor): the user picks or creates a secret in Obsidian's keychain, which keeps it
 * OUTSIDE the vault, per device, OS-encrypted. Only the secret's NAME reaches
 * `request.onChange`; the key itself never passes through this plugin's settings.
 *
 * ONE construction for both surfaces that offer it — the settings tab (through
 * `Setting.addComponent`) and the in-graph Relationships menu (through
 * `GraphUiPort.mountSecretPicker`) — so they cannot drift on naming or wiring.
 *
 * The component renders its own control(s) with no name of their own (the row's
 * name sits in a sibling element), so the row's declared name is put on each.
 */
export function createSecretPicker(app: App, el: HTMLElement, request: SecretPickerRequest): SecretComponent {
	const picker = new SecretComponent(app, el).setValue(request.secretName).onChange(request.onChange);
	for (const control of Array.from(el.querySelectorAll(PICKER_CONTROLS))) {
		if (!control.hasAttribute("aria-label")) {
			control.setAttribute("aria-label", request.accessibleName);
		}
	}
	return picker;
}
