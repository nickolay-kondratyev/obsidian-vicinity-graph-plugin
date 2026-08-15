import type { ReactElement } from "react";

/**
 * An Obsidian-native toggle switch for the React panel. Obsidian's `Setting`
 * API can't be mounted inside the React tree, so this reuses Obsidian's OWN
 * toggle markup contract instead: a `checkbox-container` div (+ `is-enabled`
 * when on) wrapping a native checkbox. Obsidian's app stylesheet renders the
 * pill/knob and stretches the invisible checkbox over it, so the control looks
 * and themes EXACTLY like a settings-tab toggle (zero plugin CSS, community
 * themes included) while keyboard focus/activation stay on the real input.
 * `mod-small` matches the panel's compact scale.
 */
export function ToggleSwitch({
	checked,
	onChange,
	ariaLabel,
	disabled,
}: {
	readonly checked: boolean;
	readonly onChange: (checked: boolean) => void;
	readonly ariaLabel: string;
	/** Renders the switch inert — on the NATIVE checkbox, so keyboard and the a11y tree agree. */
	readonly disabled?: boolean;
}): ReactElement {
	return (
		<div className={checked ? "checkbox-container mod-small is-enabled" : "checkbox-container mod-small"}>
			<input
				type="checkbox"
				checked={checked}
				aria-label={ariaLabel}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
			/>
		</div>
	);
}
