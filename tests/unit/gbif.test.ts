import { describe, expect, it, vi } from 'vitest';
import { checkNameWithGbif, mapGbifMatch } from '$lib/server/external/gbif';
import { UserFacingError } from '$lib/errors';
import accepted from './fixtures/gbif-match-accepted.json';
import synonym from './fixtures/gbif-match-synonym.json';
import speciesAccepted from './fixtures/gbif-species-accepted.json';
import higherRank from './fixtures/gbif-match-higherrank.json';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('mapGbifMatch', () => {
	it('accepts an exact accepted species', () => {
		expect(mapGbifMatch(accepted)).toEqual({
			match: 'accepted',
			key: 5341258,
			acceptedKey: null,
			canonicalName: 'Myosotis arvensis',
			family: 'Boraginaceae'
		});
	});

	it('reports a missing family as null', () => {
		const { family: _drop, ...noFamily } = accepted as Record<string, unknown>;
		expect(mapGbifMatch(noFamily).family).toBeNull();
	});

	it('flags a synonym with its accepted key', () => {
		expect(mapGbifMatch(synonym)).toMatchObject({
			match: 'synonym',
			key: 5341262,
			acceptedKey: 5341270
		});
		for (const status of ['HETEROTYPIC_SYNONYM', 'HOMOTYPIC_SYNONYM', 'PROPARTE_SYNONYM']) {
			expect(mapGbifMatch({ ...synonym, status }).match).toBe('synonym');
		}
	});

	it('flags doubtful names', () => {
		expect(mapGbifMatch({ ...accepted, status: 'DOUBTFUL' }).match).toBe('doubtful');
	});

	it('rejects fuzzy, higher-rank and non-species matches', () => {
		expect(mapGbifMatch({ ...accepted, matchType: 'FUZZY' }).match).toBe('none');
		expect(mapGbifMatch(higherRank).match).toBe('none');
		expect(mapGbifMatch({ ...accepted, rank: 'GENUS' }).match).toBe('none');
		expect(mapGbifMatch({ ...accepted, matchType: 'NONE' }).match).toBe('none');
	});

	it('accepts infraspecific ranks', () => {
		for (const rank of ['SUBSPECIES', 'VARIETY', 'FORM']) {
			expect(mapGbifMatch({ ...accepted, rank }).match).toBe('accepted');
		}
	});

	it('returns none for garbage', () => {
		for (const bad of [null, 'x', {}, { matchType: 'EXACT', rank: 'SPECIES', status: 'ACCEPTED' }]) {
			expect(mapGbifMatch(bad)).toMatchObject({ match: 'none', key: null });
		}
	});
});

describe('checkNameWithGbif', () => {
	it('returns accepted with one request and an encoded name', async () => {
		const fetchFn = vi.fn(async () => json(accepted));
		const r = await checkNameWithGbif('Myosotis arvensis', fetchFn as never);
		expect(r).toEqual({ match: 'accepted', key: 5341258, acceptedKey: null, acceptedName: null, family: 'Boraginaceae' });
		expect(fetchFn).toHaveBeenCalledTimes(1);
		expect((fetchFn.mock.calls[0] as unknown[])[0]).toBe(
			`https://api.gbif.org/v1/species/match?name=${encodeURIComponent('Myosotis arvensis')}&strict=true`
		);
	});

	it('encodes special characters in the name', async () => {
		const fetchFn = vi.fn(async () => json(accepted));
		await checkNameWithGbif('Viola × wittrockiana&x=1', fetchFn as never);
		expect((fetchFn.mock.calls[0] as unknown[])[0]).toContain(
			encodeURIComponent('Viola × wittrockiana&x=1')
		);
	});

	it('makes a second request for the accepted name of a synonym', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce(json(synonym))
			.mockResolvedValueOnce(json(speciesAccepted));
		const r = await checkNameWithGbif('Myosotis scorpioides', fetchFn as never);
		expect(r).toEqual({
			match: 'synonym',
			key: 5341262,
			acceptedKey: 5341270,
			acceptedName: 'Myosotis palustris',
			family: 'Boraginaceae'
		});
		expect(fetchFn).toHaveBeenCalledTimes(2);
		expect(fetchFn.mock.calls[1][0]).toBe('https://api.gbif.org/v1/species/5341270');
	});

	it('throws a UserFacingError on a non-2xx response', async () => {
		const fetchFn = vi.fn(async () => json({}, 500));
		await expect(checkNameWithGbif('X y', fetchFn as never)).rejects.toThrow(UserFacingError);
		await expect(checkNameWithGbif('X y', fetchFn as never)).rejects.toThrow(
			'Името не можа да се провери в GBIF.'
		);
	});

	it('throws a UserFacingError on a network error and on a failing second request', async () => {
		const boom = vi.fn(async () => {
			throw new Error('down');
		});
		await expect(checkNameWithGbif('X y', boom as never)).rejects.toThrow(UserFacingError);
		const second = vi.fn().mockResolvedValueOnce(json(synonym)).mockResolvedValueOnce(json({}, 503));
		await expect(checkNameWithGbif('X y', second as never)).rejects.toThrow(UserFacingError);
	});
});
