/** Axis-aligned box in layout space (top-left origin), for test assertions. */
export interface Aabb {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/**
 * Number of strictly-overlapping box pairs — the shared "no layout overlaps"
 * test predicate (0 means the layout is overlap-free). Touching edges do NOT
 * count as overlap (strict inequalities), matching the collide force's goal of
 * separated-or-touching boxes.
 */
export function countOverlappingAabbPairs(boxes: readonly Aabb[]): number {
	let count = 0;
	for (let i = 0; i < boxes.length; i++) {
		for (let j = i + 1; j < boxes.length; j++) {
			const a = boxes[i] as Aabb;
			const b = boxes[j] as Aabb;
			if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) {
				count += 1;
			}
		}
	}
	return count;
}
