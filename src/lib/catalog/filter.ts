import type { IdStatus } from '$lib/status';

export type StatusFilter = 'all' | IdStatus;

export const PAGE_SIZES = [6, 12] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

const STATUS_FILTERS: readonly string[] = ['all', 'draft', 'ai_gbif', 'community'];

export function normalizeForSearch(value: string): string {
	return value.normalize('NFC').toLocaleLowerCase('bg').replace(/\s+/g, ' ').trim();
}

export function filterPlants<T extends { name_bg: string; scientific_name: string; id_status: IdStatus }>(
	plants: T[],
	query: string,
	status: StatusFilter
): T[] {
	const needle = normalizeForSearch(query);
	return plants.filter(
		(plant) =>
			(status === 'all' || plant.id_status === status) &&
			(needle === '' ||
				normalizeForSearch(plant.name_bg).includes(needle) ||
				normalizeForSearch(plant.scientific_name).includes(needle))
	);
}

export function paginate<T>(items: T[], page: number, size: PageSize): { items: T[]; page: number; pages: number } {
	const pages = Math.max(1, Math.ceil(items.length / size));
	const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
	return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}

export function parseCatalogParams(params: URLSearchParams): { q: string; s: StatusFilter; n: PageSize; p: number } {
	const s = params.get('s') ?? '';
	const n = Number(params.get('n'));
	const p = Number(params.get('p'));
	return {
		q: params.get('q') ?? '',
		s: STATUS_FILTERS.includes(s) ? (s as StatusFilter) : 'all',
		n: (PAGE_SIZES as readonly number[]).includes(n) ? (n as PageSize) : 12,
		p: Number.isInteger(p) && p >= 1 ? p : 1
	};
}

/** Page numbers to show: first, last and the current one with its neighbours; `null` marks a gap (at most 7 slots). */
export function pageWindow(page: number, pages: number): (number | null)[] {
	if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
	const from = Math.max(2, Math.min(page - 1, pages - 4));
	const to = Math.min(pages - 1, Math.max(page + 1, 5));
	const middle = Array.from({ length: to - from + 1 }, (_, i) => from + i);
	// A gap of exactly one page shows that page instead of an ellipsis.
	const before = from === 3 ? [2] : from > 3 ? [null] : [];
	const after = to === pages - 2 ? [pages - 1] : to < pages - 2 ? [null] : [];
	return [1, ...before, ...middle, ...after, pages];
}
