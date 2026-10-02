import { describe, expect, it } from 'vitest';
import { parseLegacyAi } from '$lib/types';

describe('parseLegacyAi', () => {
	it('keeps known string fields and drops everything else', () => {
		expect(
			parseLegacyAi({ risks: 'Отровна', uses: '', benefits: 42, confidence: 'Потвърдено (AI 90%)', extra: 'x', legacy_id: 'abc' })
		).toEqual({ risks: 'Отровна', confidence: 'Потвърдено (AI 90%)', legacy_id: 'abc' });
	});

	it('returns null for non-objects and for objects without usable fields', () => {
		expect(parseLegacyAi(null)).toBeNull();
		expect(parseLegacyAi('text')).toBeNull();
		expect(parseLegacyAi([])).toBeNull();
		expect(parseLegacyAi({ uses: '   ' })).toBeNull();
	});
});
