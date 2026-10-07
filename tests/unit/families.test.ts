import { describe, expect, it } from 'vitest';
import { familyGroups, inFamily, parseFamily } from '$lib/catalog/families';

describe('parseFamily', () => {
	it('reads the Latin family and the Bulgarian name in brackets', () => {
		expect(parseFamily('Asteraceae (Сложноцветни)')).toEqual({ latin: 'Asteraceae', bg: 'Сложноцветни' });
	});
	it('reads a Latin family without a Bulgarian name', () => {
		expect(parseFamily('Onagraceae')).toEqual({ latin: 'Onagraceae', bg: null });
	});
	it('reads the reversed form "Bulgarian (Latin)"', () => {
		expect(parseFamily('Точеникови (Apocynaceae)')).toEqual({ latin: 'Apocynaceae', bg: 'Точеникови' });
	});
	it('takes the last Latin family when two are given', () => {
		expect(parseFamily('Adoxaceae / Viburnaceae (Мешковицови)')).toEqual({ latin: 'Viburnaceae', bg: 'Мешковицови' });
	});
	it('keeps Fungi as its own group', () => {
		expect(parseFamily('Fungi')).toEqual({ latin: 'Fungi', bg: null });
		expect(parseFamily('Fungi (Гъби)')).toEqual({ latin: 'Fungi', bg: 'Гъби' });
	});
	it('returns nothing for an empty or missing family', () => {
		expect(parseFamily(null)).toEqual({ latin: null, bg: null });
		expect(parseFamily('   ')).toEqual({ latin: null, bg: null });
	});
	it('does not invent a Latin family from free text', () => {
		expect(parseFamily('незнайно')).toEqual({ latin: null, bg: null });
	});
});

describe('familyGroups', () => {
	const plants = [
		{ family: 'Asteraceae (Сложноцветни)' },
		{ family: 'Asteraceae' },
		{ family: 'Lamiaceae (Устноцветни)' },
		{ family: 'Rosaceae' },
		{ family: 'Rosaceae (Розоцветни)' },
		{ family: 'Asteraceae (Сложноцветни)' },
		{ family: null }
	];

	it('counts plants per Latin family, largest first, then alphabetically', () => {
		expect(familyGroups(plants).map((g) => [g.latin, g.count])).toEqual([
			['Asteraceae', 3],
			['Rosaceae', 2],
			['Lamiaceae', 1]
		]);
	});
	it('takes the Bulgarian name from any plant of the family that has one', () => {
		expect(familyGroups(plants).find((g) => g.latin === 'Rosaceae')?.bg).toBe('Розоцветни');
	});
	it('leaves plants without a family out of the groups', () => {
		expect(familyGroups(plants).reduce((sum, g) => sum + g.count, 0)).toBe(6);
	});
});

describe('inFamily', () => {
	it('matches a stored family by its Latin key in any format', () => {
		expect(inFamily('Точеникови (Apocynaceae)', 'Apocynaceae')).toBe(true);
		expect(inFamily('Asteraceae (Сложноцветни)', 'Lamiaceae')).toBe(false);
		expect(inFamily(null, 'Asteraceae')).toBe(false);
	});
});
