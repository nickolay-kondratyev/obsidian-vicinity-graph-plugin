/**
 * The ONE acceptance rule shared by every typed sizing number field (the
 * settings tab's min/max/k/weight inputs and the in-view panel's sizing rows). It
 * answers "is this keystroke a value at all?"; deciding whether the value is sane is
 * `clampSizingSettings`' job downstream, so an out-of-range but real number IS
 * forwarded and clamped rather than silently dropped mid-typing.
 *
 * Rejected:
 * - blank — `Number("")` is `0`, so forwarding a cleared field would persist a
 *   size (clamped to the range minimum) the user never typed, the moment they
 *   select-all-delete to retype.
 * - non-numeric text — `Number("abc")` is `NaN`.
 * - out of double range — `Number("1e999")` is `Infinity`, which the `max`
 *   attribute does not block and which is not `NaN`.
 */
export function parseSizingInput(raw: string): number | undefined {
	if (raw.trim() === "") {
		return undefined;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : undefined;
}
