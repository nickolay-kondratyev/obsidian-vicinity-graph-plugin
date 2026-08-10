/**
 * Renders a clock instant (epoch millis) as a filename-safe, human-readable
 * timestamp `YYYY-MM-DDTHH-mm-ss` — the suffix a quarantined file wears
 * (`<base>_malformed_<ts><ext>`).
 *
 * WHY this shape: colons (ISO's `HH:mm:ss`) are illegal in filenames on Windows
 * and awkward everywhere, so the time separators are `-`; the `T` between date
 * and time stays, keeping it legible at a glance. Rendered in UTC so the string
 * is deterministic regardless of the machine's timezone (tests assert an exact
 * value from a fixed instant).
 *
 * Pure and injected-clock-driven: {@link VaultFileStore} never calls
 * `Date.now()`/`new Date()` itself — it passes the store's `clock()` here.
 */
export function formatQuarantineTimestamp(epochMillis: number): string {
	const at = new Date(epochMillis);
	const year = at.getUTCFullYear().toString().padStart(4, "0");
	const month = pad2(at.getUTCMonth() + 1);
	const day = pad2(at.getUTCDate());
	const hours = pad2(at.getUTCHours());
	const minutes = pad2(at.getUTCMinutes());
	const seconds = pad2(at.getUTCSeconds());
	return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}`;
}

function pad2(value: number): string {
	return value.toString().padStart(2, "0");
}
