/** Distinct calendar months (1–12, UTC) in which photos were taken; undated photos are skipped. */
export function photoMonths(dates: readonly (string | null | undefined)[]): number[] {
	const months = new Set<number>();
	for (const value of dates) {
		if (!value) continue;
		const time = Date.parse(value);
		if (Number.isNaN(time)) continue;
		months.add(new Date(time).getUTCMonth() + 1);
	}
	return [...months].sort((a, b) => a - b);
}
