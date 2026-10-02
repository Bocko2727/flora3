import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.doUnmock('$env/dynamic/private');
	vi.resetModules();
});

async function load(flag: string | undefined) {
	vi.resetModules();
	vi.doMock('$env/dynamic/private', () => ({ env: { FLORA_OFFLINE_EXTERNAL: flag } }));
	return (await import('$lib/server/external/fetch')).externalFetch;
}

describe('externalFetch', () => {
	it('returns the global fetch by default', async () => {
		expect((await load(undefined))()).toBe(fetch);
		expect((await load('0'))()).toBe(fetch);
	});

	it('rejects every request when FLORA_OFFLINE_EXTERNAL=1', async () => {
		const offline = (await load('1'))();
		expect(offline).not.toBe(fetch);
		await expect(offline('https://my-api.plantnet.org/v2/identify/all')).rejects.toThrow(
			'external network disabled (FLORA_OFFLINE_EXTERNAL)'
		);
	});
});
