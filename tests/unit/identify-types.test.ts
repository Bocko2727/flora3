import { describe, expect, it } from 'vitest';
import {
	IDENTIFY_MESSAGES,
	deriveNameSource,
	fail,
	identificationSchema,
	parseIdentificationField,
	sameName,
	type Candidate
} from '$lib/identify/types';

const cand = (over: Partial<Candidate> = {}): Candidate => ({
	scientific_name: 'Myosotis arvensis',
	authorship: '(L.) Hill',
	family: 'Boraginaceae',
	genus: 'Myosotis',
	common_names: ['Незабравка'],
	score: 0.62,
	gbif_key: 5341258,
	...over
});

const valid = (over: Record<string, unknown> = {}) => ({
	modelVersion: '2025-01-17 (7.3)',
	photoCount: 2,
	candidates: [cand(), cand({ scientific_name: 'Myosotis sylvatica', score: 0.2 })],
	chosenIndex: 0,
	...over
});

describe('fail / messages', () => {
	it('builds a failure with the Bulgarian message', () => {
		expect(fail('quota')).toEqual({
			ok: false,
			code: 'quota',
			message: 'Лимитът за разпознаване за днес е изчерпан.'
		});
		expect(IDENTIFY_MESSAGES.no_match).toBe('AI не разпозна растението. Попълни името сам.');
		expect(IDENTIFY_MESSAGES.not_configured).toBe('AI разпознаването не е настроено.');
		expect(IDENTIFY_MESSAGES.upstream).toBe('AI не отговори.');
		expect(IDENTIFY_MESSAGES.bad_request).toBe('Снимките не можаха да се изпратят. Опитай пак.');
		expect(IDENTIFY_MESSAGES.forbidden).toBe('Нямаш права за това действие.');
	});
});

describe('parseIdentificationField', () => {
	it('parses a valid payload', () => {
		const input = valid();
		expect(parseIdentificationField(JSON.stringify(input))).toEqual(input);
	});

	it('accepts a null chosenIndex and null modelVersion', () => {
		expect(
			parseIdentificationField(JSON.stringify(valid({ chosenIndex: null, modelVersion: null })))
		).not.toBeNull();
	});

	it('returns null for empty, missing, non-string or invalid JSON', () => {
		expect(parseIdentificationField(null)).toBeNull();
		expect(parseIdentificationField('')).toBeNull();
		expect(parseIdentificationField(new File(['x'], 'x.txt'))).toBeNull();
		expect(parseIdentificationField('not json')).toBeNull();
	});

	it('rejects a chosenIndex outside the candidates', () => {
		expect(parseIdentificationField(JSON.stringify(valid({ chosenIndex: 5 })))).toBeNull();
		expect(parseIdentificationField(JSON.stringify(valid({ chosenIndex: -1 })))).toBeNull();
	});

	it('rejects photoCount outside 1..5', () => {
		expect(parseIdentificationField(JSON.stringify(valid({ photoCount: 6 })))).toBeNull();
		expect(parseIdentificationField(JSON.stringify(valid({ photoCount: 0 })))).toBeNull();
	});

	it('rejects more than 10 candidates', () => {
		const candidates = Array.from({ length: 11 }, () => cand());
		expect(parseIdentificationField(JSON.stringify(valid({ candidates })))).toBeNull();
	});
});

describe('candidate schema hardening (values are cast to numeric/bigint in SQL)', () => {
	const parse = (c: unknown) =>
		identificationSchema.safeParse(valid({ candidates: [c], chosenIndex: null })).success;

	it('accepts a well-formed candidate', () => {
		expect(parse(cand())).toBe(true);
		expect(parse(cand({ gbif_key: null, authorship: null, family: null, genus: null }))).toBe(true);
	});

	it('rejects a score outside [0,1] or not finite', () => {
		expect(parse(cand({ score: 1.01 }))).toBe(false);
		expect(parse(cand({ score: -0.1 }))).toBe(false);
		expect(parse(cand({ score: Number.NaN }))).toBe(false);
		expect(parse({ ...cand(), score: '0.5' })).toBe(false);
	});

	it('rejects a non-integer or non-numeric gbif_key', () => {
		expect(parse(cand({ gbif_key: 1.5 }))).toBe(false);
		expect(parse({ ...cand(), gbif_key: '123' })).toBe(false);
	});

	it('rejects empty or overlong names and oversized common_names', () => {
		expect(parse(cand({ scientific_name: '' }))).toBe(false);
		expect(parse(cand({ scientific_name: 'x'.repeat(201) }))).toBe(false);
		expect(parse(cand({ family: 'x'.repeat(201) }))).toBe(false);
		expect(parse(cand({ common_names: Array(21).fill('a') }))).toBe(false);
		expect(parse(cand({ common_names: ['x'.repeat(201)] }))).toBe(false);
		expect(parse({ ...cand(), common_names: 'a' })).toBe(false);
	});
});

describe('sameName', () => {
	it('ignores case and extra whitespace', () => {
		expect(sameName(' myosotis  ARVENSIS ', 'Myosotis arvensis')).toBe(true);
		expect(sameName('Myosotis arvensis', 'Myosotis sylvatica')).toBe(false);
	});
});

describe('deriveNameSource', () => {
	const ident = parseIdentificationField(JSON.stringify(valid()))!;

	it('is ai when the chosen candidate matches the submitted name', () => {
		expect(deriveNameSource(ident, ' myosotis  ARVENSIS ', null)).toBe('ai');
	});

	it('is manual when the name differs from the chosen candidate', () => {
		expect(deriveNameSource(ident, 'Myosotis sylvatica', null)).toBe('manual');
	});

	it('is manual when no candidate was chosen', () => {
		const none = parseIdentificationField(JSON.stringify(valid({ chosenIndex: null })))!;
		expect(deriveNameSource(none, 'Myosotis arvensis', null)).toBe('manual');
	});

	it('keeps the previous source when the name is unchanged', () => {
		const previous = { name: 'Bellis perennis', source: 'legacy_ai' as const };
		expect(deriveNameSource(null, 'Bellis perennis', previous)).toBe('legacy_ai');
	});

	it('is manual when the name changed or there is no history', () => {
		const previous = { name: 'Bellis perennis', source: 'legacy_ai' as const };
		expect(deriveNameSource(null, 'Bellis annua', previous)).toBe('manual');
		expect(deriveNameSource(null, 'Bellis annua', null)).toBe('manual');
	});
});
