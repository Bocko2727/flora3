import { describe, expect, it, vi } from 'vitest';
import { identifyWithPlantNet, parsePlantNetResponse } from '$lib/server/external/plantnet';
import plantnetOk from './fixtures/plantnet-ok.json';

const KEY = 'SECRET-KEY-123';
const images = () => [
	new Blob(['a'], { type: 'image/jpeg' }),
	new Blob(['b'], { type: 'image/jpeg' })
];
const respond = (status: number, body: unknown = {}) =>
	vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('parsePlantNetResponse', () => {
	it('returns at most 5 candidates sorted by score with the model version', () => {
		const out = parsePlantNetResponse(plantnetOk);
		expect(out.modelVersion).toBe('2025-01-17 (7.3)');
		expect(out.candidates).toHaveLength(5);
		expect(out.candidates[0]).toEqual({
			scientific_name: 'Myosotis arvensis',
			authorship: '(L.) Hill',
			family: 'Boraginaceae',
			genus: 'Myosotis',
			common_names: ['Field forget-me-not', 'Незабравка'],
			score: 0.62,
			gbif_key: 5341258
		});
		const scores = out.candidates.map((c) => c.score);
		expect(scores).toEqual([...scores].sort((a, b) => b - a));
	});

	it('skips results without a species and parses gbif ids to integers or null', () => {
		const out = parsePlantNetResponse(plantnetOk);
		expect(plantnetOk.results).toHaveLength(7);
		expect(out.candidates.every((c) => c.scientific_name.length > 0)).toBe(true);
		const lith = parsePlantNetResponse({
			results: [
				{
					score: 0.4,
					species: { scientificNameWithoutAuthor: 'Lithospermum arvense' },
					gbif: { id: null }
				}
			]
		});
		expect(lith.candidates[0]).toMatchObject({ gbif_key: null, authorship: null, family: null });
	});

	it('clamps scores into [0,1] and tolerates garbage', () => {
		const out = parsePlantNetResponse({
			results: [
				{ score: 1.7, species: { scientificNameWithoutAuthor: 'A a' } },
				{ score: -2, species: { scientificNameWithoutAuthor: 'B b' } },
				{ score: 'x', species: { scientificNameWithoutAuthor: 'C c' } }
			]
		});
		expect(out.candidates.map((c) => c.score)).toEqual([1, 0]);
		expect(parsePlantNetResponse(null)).toEqual({ modelVersion: null, candidates: [] });
		expect(parsePlantNetResponse({ results: 'no' })).toEqual({ modelVersion: null, candidates: [] });
	});
});

describe('identifyWithPlantNet', () => {
	it('POSTs multipart images and organs to the exact URL', async () => {
		const fetchFn = respond(200, plantnetOk);
		const result = await identifyWithPlantNet(images(), KEY, fetchFn as unknown as typeof fetch);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.candidates).toHaveLength(5);
			expect(result.modelVersion).toBe('2025-01-17 (7.3)');
		}
		const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(
			`https://my-api.plantnet.org/v2/identify/all?api-key=${KEY}&nb-results=5&include-related-images=false`
		);
		expect(init.method).toBe('POST');
		const body = init.body as FormData;
		expect(body.getAll('images')).toHaveLength(2);
		expect(body.getAll('organs')).toEqual(['auto', 'auto']);
		expect(init.signal).toBeDefined();
	});

	it('maps 200 with no candidates to no_match', async () => {
		const r = await identifyWithPlantNet(images(), KEY, respond(200, { results: [] }) as never);
		expect(r).toMatchObject({ ok: false, code: 'no_match' });
	});

	it.each([
		[404, 'no_match'],
		[429, 'quota'],
		[401, 'not_configured'],
		[403, 'not_configured'],
		[500, 'upstream'],
		[400, 'upstream']
	])('maps HTTP %i to %s', async (status, code) => {
		const r = await identifyWithPlantNet(images(), KEY, respond(status) as never);
		expect(r).toMatchObject({ ok: false, code });
	});

	it('maps a thrown fetch to upstream without leaking the key', async () => {
		const fetchFn = vi.fn(async () => {
			throw new Error(`connect failed for https://x?api-key=${KEY}`);
		});
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const r = await identifyWithPlantNet(images(), KEY, fetchFn as never);
		expect(r).toMatchObject({ ok: false, code: 'upstream' });
		expect(JSON.stringify(r)).not.toContain(KEY);
		expect(JSON.stringify(errSpy.mock.calls)).not.toContain(KEY);
		errSpy.mockRestore();
	});

	it('maps a non-JSON 200 body to upstream', async () => {
		const fetchFn = vi.fn(async () => new Response('<html>', { status: 200 }));
		const r = await identifyWithPlantNet(images(), KEY, fetchFn as never);
		expect(r).toMatchObject({ ok: false, code: 'upstream' });
	});
});
