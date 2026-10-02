import { describe, expect, it } from 'vitest';
import { filterPlants, normalizeForSearch, paginate, parseCatalogParams } from '$lib/catalog/filter';
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

describe('paginate', () => {
	const items = Array.from({ length: 13 }, (_, i) => i + 1);
	it('returns the first page of twelve and counts two pages', () => {
		const result = paginate(items, 1, 12);
		expect(result.items).toHaveLength(12);
		expect(result.page).toBe(1);
		expect(result.pages).toBe(2);
	});
	it('returns the remainder on the last page', () => {
		expect(paginate(items, 2, 12)).toEqual({ items: [13], page: 2, pages: 2 });
	});
	it('clamps a page past the end to the last page', () => {
		expect(paginate(items, 99, 12).page).toBe(2);
		expect(paginate(items, 99, 12).items).toEqual([13]);
	});
	it('clamps a page below one to the first page', () => {
		expect(paginate(items, 0, 12).page).toBe(1);
	});
	it('has one empty page for no items', () => {
		expect(paginate([], 1, 6)).toEqual({ items: [], page: 1, pages: 1 });
	});
});

describe('parseCatalogParams', () => {
	it('falls back to defaults for missing and invalid values', () => {
		expect(parseCatalogParams(new URLSearchParams(''))).toEqual({ q: '', s: 'all', n: 12, p: 1 });
		expect(parseCatalogParams(new URLSearchParams('n=7&p=-3&s=xyz&q=%20лай'))).toEqual({
			q: ' лай',
			s: 'all',
			n: 12,
			p: 1
		});
		expect(parseCatalogParams(new URLSearchParams('p=1.5'))).toMatchObject({ p: 1 });
		expect(parseCatalogParams(new URLSearchParams('p=abc'))).toMatchObject({ p: 1 });
	});
	it('reads valid values', () => {
		expect(parseCatalogParams(new URLSearchParams('n=6&p=3&s=community'))).toEqual({
			q: '',
			s: 'community',
			n: 6,
			p: 3
		});
	});
});
