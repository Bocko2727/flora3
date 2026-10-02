import { describe, expect, it } from 'vitest';
import { classify } from '$lib/server/review';
import type { Candidate } from '$lib/identify/types';

const c = (scientific_name: string, score: number, gbif_key: number | null = null): Candidate => ({
	scientific_name,
	authorship: null,
	family: 'Asteraceae',
	genus: scientific_name.split(' ')[0],
	common_names: [],
	score,
	gbif_key
});
const plant = (scientific_name: string, gbif_key: number | null = null, gbif_accepted_key: number | null = null) => ({
	scientific_name,
	gbif_key,
	gbif_accepted_key
});

describe('classify', () => {
	it('matches by GBIF key', () => {
		expect(classify(plant('Bellis perennis', 3117813), [c('Bellis sylvestris', 0.5, 1), c('Bellis perennis L.', 0.4, 3117813)])).toEqual({
			kind: 'match',
			index: 1
		});
	});

	it('matches by accepted key of a synonym', () => {
		expect(classify(plant('Bellis old', 111, 3117813), [c('Bellis perennis', 0.6, 3117813)])).toEqual({ kind: 'match', index: 0 });
	});

	it('matches by name when the candidate has no key (author ignored, case-insensitive)', () => {
		expect(classify(plant('Bellis perennis'), [c('BELLIS PERENNIS L.', 0.31)])).toEqual({ kind: 'match', index: 0 });
	});

	it('is weak below 30 %', () => {
		expect(classify(plant('Bellis perennis'), [c('Bellis perennis', 0.29)])).toEqual({ kind: 'weak', index: 0, score: 0.29 });
	});

	it('is a mismatch and lists candidates of the same genus', () => {
		expect(classify(plant('Bellis perennis'), [c('Bellis sylvestris', 0.7), c('Erigeron annuus', 0.2)])).toEqual({
			kind: 'mismatch',
			sameGenus: [0]
		});
	});

	it('treats "sp." as a genus, never as a species match', () => {
		expect(classify(plant('Cistus sp.'), [c('Cistus creticus', 0.8), c('Cistus sp.', 0.5)])).toEqual({
			kind: 'mismatch',
			sameGenus: [0, 1]
		});
	});

	it('is none without candidates', () => {
		expect(classify(plant('Bellis perennis'), [])).toEqual({ kind: 'none' });
	});
});
