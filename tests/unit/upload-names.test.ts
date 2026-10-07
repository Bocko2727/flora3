import { describe, expect, it } from 'vitest';
import { findExisting, normalizeName } from '$lib/upload/names';

describe('normalizeName', () => {
	it('ignores case, outer and repeated whitespace', () => {
		expect(normalizeName('  Bellis   PERENNIS ')).toBe('bellis perennis');
	});
});

describe('findExisting', () => {
	const catalog = [
		{ id: 'a', scientific_name: 'Bellis perennis' },
		{ id: 'b', scientific_name: 'Taraxacum officinale' }
	];

	it('finds a plant with the same Latin name regardless of case and spacing', () => {
		expect(findExisting('bellis  perennis', catalog)?.id).toBe('a');
	});

	it('returns null for a new name and for an empty one', () => {
		expect(findExisting('Rosa canina', catalog)).toBeNull();
		expect(findExisting('   ', catalog)).toBeNull();
	});

	it('does not match a different species of the same genus', () => {
		expect(findExisting('Bellis annua', catalog)).toBeNull();
	});
});
