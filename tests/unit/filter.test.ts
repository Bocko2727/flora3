import { describe, expect, it } from 'vitest';
import { filterPlants, normalizeForSearch } from '$lib/catalog/filter';

const plants = [
	{ id: '1', name_bg: 'Лайка', scientific_name: 'Matricaria chamomilla', family: 'Asteraceae', status: 'confirmed' },
	{ id: '2', name_bg: 'Глухарче', scientific_name: 'Taraxacum officinale', family: 'Asteraceae', status: 'unverified' },
	{ id: '3', name_bg: 'Мащерка', scientific_name: 'Thymus serpyllum', family: 'Lamiaceae', status: 'unverified' }
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
		expect(filterPlants(plants, '', 'unverified').map((p) => p.id)).toEqual(['2', '3']);
		expect(filterPlants(plants, '', 'confirmed').map((p) => p.id)).toEqual(['1']);
	});
	it('combines query and status', () => {
		expect(filterPlants(plants, 'а', 'confirmed').map((p) => p.id)).toEqual(['1']);
	});
});
