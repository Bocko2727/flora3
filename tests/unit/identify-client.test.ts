import { describe, expect, it, vi } from 'vitest';
import { latestOnly, prepareImages, requestIdentification } from '$lib/identify/client';
import { IDENTIFY_MESSAGES, type IdentifyOk } from '$lib/identify/types';

const okBody: IdentifyOk = {
	ok: true,
	modelVersion: '2025-01-17 (7.3)',
	candidates: [
		{
			scientific_name: 'Bellis perennis',
			authorship: 'L.',
			family: 'Asteraceae',
			genus: 'Bellis',
			common_names: ['Паричка'],
			score: 0.71,
			gbif_key: 3117813
		}
	]
};

const reply = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const blob = () => new Blob(['x'], { type: 'image/jpeg' });

describe('requestIdentification', () => {
	it('returns a successful body unchanged and posts the images as multipart with manual redirects', async () => {
		const fetchFn = vi.fn<typeof fetch>(async () => reply(200, okBody));
		const result = await requestIdentification([blob(), blob()], fetchFn);
		expect(result).toEqual(okBody);
		const [url, init] = fetchFn.mock.calls[0];
		expect(url).toBe('/api/identify');
		expect(init?.method).toBe('POST');
		expect(init?.redirect).toBe('manual');
		expect((init?.body as FormData).getAll('images')).toHaveLength(2);
	});

	it('returns a handled failure body (quota) as is', async () => {
		const body = { ok: false, code: 'quota', message: IDENTIFY_MESSAGES.quota };
		const result = await requestIdentification([blob()], async () => reply(429, body));
		expect(result).toEqual(body);
	});

	it('maps the bare { message } bodies of SvelteKit errors by status', async () => {
		const message = { message: 'x' };
		expect(await requestIdentification([blob()], async () => reply(403, message))).toMatchObject({ code: 'forbidden' });
		expect(await requestIdentification([blob()], async () => reply(400, message))).toMatchObject({ code: 'bad_request' });
		expect(await requestIdentification([blob()], async () => reply(503, message))).toMatchObject({ code: 'upstream' });
	});

	it('maps a non-JSON response to upstream', async () => {
		const result = await requestIdentification([blob()], async () => new Response('<html>', { status: 502 }));
		expect(result).toMatchObject({ ok: false, code: 'upstream', message: IDENTIFY_MESSAGES.upstream });
	});

	it('maps a network error to upstream', async () => {
		const result = await requestIdentification([blob()], async () => {
			throw new TypeError('Failed to fetch');
		});
		expect(result).toMatchObject({ ok: false, code: 'upstream' });
	});

	it('maps an opaque redirect (expired session) to forbidden', async () => {
		const result = await requestIdentification([blob()], async () => ({ type: 'opaqueredirect', status: 0 }) as unknown as Response);
		expect(result).toMatchObject({ ok: false, code: 'forbidden', message: IDENTIFY_MESSAGES.forbidden });
	});
});

describe('latestOnly', () => {
	it('marks an older response stale when a newer call was made after it started', async () => {
		const resolvers: ((value: string) => void)[] = [];
		const guarded = latestOnly(() => new Promise<string>((resolve) => resolvers.push(resolve)));
		const first = guarded();
		const second = guarded();
		resolvers[1]('second');
		resolvers[0]('first');
		expect(await first).toEqual({ stale: true, value: 'first' });
		expect(await second).toEqual({ stale: false, value: 'second' });
	});

	it('keeps a lone call fresh', async () => {
		const guarded = latestOnly(async (n: number) => n * 2);
		expect(await guarded(2)).toEqual({ stale: false, value: 4 });
	});
});

describe('prepareImages', () => {
	it('returns an empty list when every conversion fails', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const result = await prepareImages([blob(), blob(), blob()], async () => {
			throw new Error('decode failed');
		});
		warn.mockRestore();
		expect(result).toEqual([]);
	});

	it('skips only the failed sources', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		let calls = 0;
		const result = await prepareImages([blob(), blob(), blob()], async (b) => {
			calls += 1;
			if (calls === 2) throw new Error('decode failed');
			return b;
		});
		expect(result).toHaveLength(2);
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();
	});

	it('converts at most the first five sources', async () => {
		const convert = vi.fn(async (b: Blob) => b);
		const result = await prepareImages(Array.from({ length: 7 }, blob), convert);
		expect(convert).toHaveBeenCalledTimes(5);
		expect(result).toHaveLength(5);
	});
});
