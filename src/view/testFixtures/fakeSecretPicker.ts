import type { SecretPickerRequest } from "../viewPorts";

/**
 * jsdom stand-in for Obsidian's `SecretComponent` (`GraphUiPort.mountSecretPicker`):
 * a plain text input showing the chosen secret's name, named by the request, whose
 * `change` reports the typed name — enough to prove the row mounts the picker, shows
 * the stored name and writes the picked one. Every mount is recorded.
 */
export class FakeSecretPicker {
	readonly mounts: SecretPickerRequest[] = [];

	readonly mount = (el: HTMLElement, request: SecretPickerRequest): (() => void) => {
		this.mounts.push(request);
		const input = el.ownerDocument.createElement("input");
		input.type = "text";
		input.value = request.secretName;
		input.setAttribute("aria-label", request.accessibleName);
		input.addEventListener("change", () => request.onChange(input.value));
		el.appendChild(input);
		return () => input.remove();
	};
}
