import { describe, expect, it, vi } from 'vitest';
import { fetchInatObservation, parseInatObservationId } from '$lib/server/external/inat';
import { UserFacingError } from '$lib/errors';
import obs from './fixtures/inat-obs.json';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('parseInatObservationId', () => {
	it.each([
		['https://www.inaturalist.org/observations/123456', 123456],
		['https://inaturalist.org/observations/77/', 77],
		['http://www.inaturalist.org/observations/5', 5],
		['123', 123],
		['  42  ', 42]
	])('parses %s', (input, id) => {
		expect(parseInatObservationId(input)).toBe(id);
	});

	it.each([
		['inaturalist.org/observations/1'],
		['https://evil.com/observations/1'],
		['https://www.inaturalist.org.evil.com/observations/1'],
		['1234567890123'],
		[''],
		['abc']
	])('rejects %s', (input) => {
		expect(parseInatObservationId(input)).toBeNull();
	});
});

describe('fetchInatObservation', () => {
	it('returns grade and taxon name, using the exact URL', async () => {
		const fetchFn = vi.fn(async () => json(obs));
		const r = await fetchInatObservation(123456, fetchFn as never);
		expect(r).toEqual({ qualityGrade: 'research', taxonName: 'Myosotis arvensis' });
		expect((fetchFn.mock.calls[0] as unknown[])[0]).toBe(
			'https://api.inaturalist.org/v1/observations/123456'
		);
	});

	it('returns null for empty results', async () => {
		const r = await fetchInatObservation(1, (async () => json({ results: [] })) as never);
		expect(r).toBeNull();
	});

	it('maps unknown grades to casual and missing taxon to null', async () => {
		const body = { results: [{ quality_grade: 'weird', taxon: null }] };
		const r = await fetchInatObservation(1, (async () => json(body)) as never);
		expect(r).toEqual({ qualityGrade: 'casual', taxonName: null });
	});

	it('throws a UserFacingError on network or HTTP failure', async () => {
		const msg = 'iNaturalist не отговори. Опитай пак.';
		await expect(fetchInatObservation(1, (async () => json({}, 500)) as never)).rejects.toThrow(msg);
		await expect(fetchInatObservation(1, (async () => json({}, 404)) as never)).rejects.toThrow(
			UserFacingError
		);
		const boom = async () => {
			throw new Error('x');
		};
		await expect(fetchInatObservation(1, boom as never)).rejects.toThrow(msg);
	});
});
