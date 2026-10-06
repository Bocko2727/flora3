import { describe, expect, it } from 'vitest';
import {
	DEFAULT_PAGE_SIZE,
	PAGE_SIZES,
	filterPlants,
	normalizeForSearch,
	pageWindow,
	paginate,
	parseCatalogParams
} from '$lib/catalog/filter';
import type { IdStatus } from '$lib/status';

const plants: { id: string; name_bg: string; scientific_name: string; family: string; id_status: IdStatus }[] = [
	{ id: '1', name_bg: 'Лайка', scientific_name: 'Matricaria chamomilla', family: 'Asteraceae', id_status: 'community' },
	{ id: '2', name_bg: 'Глухарче', scientific_name: 'Taraxacum officinale', family: 'Asteraceae', id_status: 'draft' },
	{ id: '3', name_bg: 'Мащерка', scientific_name: 'Thymus serpyllum', family: 'Lamiaceae', id_status: 'ai_gbif' }
];

describe('normalizeForSearch', () => {
	it('lowercases Cyrillic and collapses whitespace', () => {
		expect(normalizeForSearch('  ГЛУХ   арче ')).toBe('глух арче');
	});
});

describe('filterPlants', () => {
	it('matches Bulgarian names case-insensitively', () => {
		expect(filterPlants(plants, 'ЛАЙ', 'all').map((p) => p.id)).toEqual(['1']);
	});
	it('matches scientific names case-insensitively and ignores surrounding spaces', () => {
		expect(filterPlants(plants, '  thymus ', 'all').map((p) => p.id)).toEqual(['3']);
	});
	it('does not match on family', () => {
		expect(filterPlants(plants, 'Asteraceae', 'all')).toEqual([]);
	});
	it('filters by status', () => {
		expect(filterPlants(plants, '', 'draft').map((p) => p.id)).toEqual(['2']);
		expect(filterPlants(plants, '', 'ai_gbif').map((p) => p.id)).toEqual(['3']);
		expect(filterPlants(plants, '', 'community').map((p) => p.id)).toEqual(['1']);
	});
	it('combines query and status', () => {
		expect(filterPlants(plants, 'а', 'community').map((p) => p.id)).toEqual(['1']);
	});
});

describe('page sizes', () => {
	it('offers 15, 30 and 45 with 15 as the default', () => {
		expect(PAGE_SIZES).toEqual([15, 30, 45]);
		expect(DEFAULT_PAGE_SIZE).toBe(15);
	});
});

describe('paginate', () => {
	const items = Array.from({ length: 16 }, (_, i) => i + 1);
	it('returns the first page of fifteen and counts two pages', () => {
		const result = paginate(items, 1, 15);
		expect(result.items).toHaveLength(15);
		expect(result.page).toBe(1);
		expect(result.pages).toBe(2);
	});
	it('returns the remainder on the last page', () => {
		expect(paginate(items, 2, 15)).toEqual({ items: [16], page: 2, pages: 2 });
	});
	it('fits everything on one page of thirty or forty-five', () => {
		expect(paginate(items, 1, 30)).toEqual({ items, page: 1, pages: 1 });
		expect(paginate(items, 1, 45)).toEqual({ items, page: 1, pages: 1 });
	});
	it('clamps a page past the end to the last page', () => {
		expect(paginate(items, 99, 15).page).toBe(2);
		expect(paginate(items, 99, 15).items).toEqual([16]);
	});
	it('clamps a page below one to the first page', () => {
		expect(paginate(items, 0, 15).page).toBe(1);
	});
	it('has one empty page for no items', () => {
		expect(paginate([], 1, 15)).toEqual({ items: [], page: 1, pages: 1 });
	});
});

describe('parseCatalogParams', () => {
	it('falls back to defaults for missing and invalid values', () => {
		expect(parseCatalogParams(new URLSearchParams(''))).toEqual({ q: '', s: 'all', n: 15, p: 1 });
		expect(parseCatalogParams(new URLSearchParams('n=7&p=-3&s=xyz&q=%20лай'))).toEqual({
			q: ' лай',
			s: 'all',
			n: 15,
			p: 1
		});
		expect(parseCatalogParams(new URLSearchParams('p=1.5'))).toMatchObject({ p: 1 });
		expect(parseCatalogParams(new URLSearchParams('p=abc'))).toMatchObject({ p: 1 });
	});
	it('treats the old sizes 6 and 12 from saved links as the default', () => {
		expect(parseCatalogParams(new URLSearchParams('n=6'))).toMatchObject({ n: 15 });
		expect(parseCatalogParams(new URLSearchParams('n=12'))).toMatchObject({ n: 15 });
	});
	it('reads valid values', () => {
		expect(parseCatalogParams(new URLSearchParams('n=30&p=3&s=community'))).toEqual({
			q: '',
			s: 'community',
			n: 30,
			p: 3
		});
		expect(parseCatalogParams(new URLSearchParams('n=45'))).toMatchObject({ n: 45 });
	});
});

describe('pageWindow', () => {
	it('lists every page when there are at most 7', () => {
		expect(pageWindow(1, 1)).toEqual([1]);
		expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});
	it('keeps first, last and neighbours of the current page in 7 slots', () => {
		expect(pageWindow(1, 17)).toEqual([1, 2, 3, 4, 5, null, 17]);
		expect(pageWindow(9, 17)).toEqual([1, null, 8, 9, 10, null, 17]);
		expect(pageWindow(17, 17)).toEqual([1, null, 13, 14, 15, 16, 17]);
	});
	it('shows a single skipped page instead of an ellipsis', () => {
		expect(pageWindow(4, 17)).toEqual([1, 2, 3, 4, 5, null, 17]);
		expect(pageWindow(14, 17)).toEqual([1, null, 13, 14, 15, 16, 17]);
	});
});
