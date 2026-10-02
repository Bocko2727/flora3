import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';
import { IDENTIFY_MAX_BYTES, IDENTIFY_MAX_FILES, handleIdentify } from '$lib/server/identify';
import { EDITOR, VIEWER, adminClient, ensureUser, signedInClient } from '../helpers/supabase';

let editor: SupabaseClient<Database>;
let viewer: SupabaseClient<Database>;
let editorId: string;
let viewerId: string;

const KEY = 'test-key';

function jpeg(size = 16, type = 'image/jpeg'): File {
	return new File([new Uint8Array(size)], 'photo.jpg', { type });
}

function plantNetOk(): Response {
	return new Response(
		JSON.stringify({
			version: '2026-01-01 (7.3)',
			results: [
				{
					score: 0.82,
					species: {
						scientificNameWithoutAuthor: 'Bellis perennis',
						scientificNameAuthorship: 'L.',
						genus: { scientificNameWithoutAuthor: 'Bellis' },
						family: { scientificNameWithoutAuthor: 'Asteraceae' },
						commonNames: ['Daisy']
					},
					gbif: { id: '3135311' }
				}
			]
		}),
		{ status: 200, headers: { 'content-type': 'application/json' } }
	);
}

function spyFetch(impl: () => Response | Promise<Response>) {
	return vi.fn<typeof fetch>(async () => impl());
}

async function usage(userId: string): Promise<number> {
	const { data, error } = await adminClient().from('api_usage').select('count').eq('user_id', userId);
	if (error) throw error;
	return data.reduce((sum, row) => sum + row.count, 0);
}

beforeAll(async () => {
	editorId = await ensureUser(EDITOR, { editor: true });
	viewerId = await ensureUser(VIEWER, { editor: false });
	editor = await signedInClient(EDITOR);
	viewer = await signedInClient(VIEWER);
});

afterEach(async () => {
	const { error } = await adminClient().from('api_usage').delete().in('user_id', [editorId, viewerId]);
	if (error) throw error;
});

describe('handleIdentify validation', () => {
	it('exposes the limits', () => {
		expect(IDENTIFY_MAX_FILES).toBe(5);
		expect(IDENTIFY_MAX_BYTES).toBe(2 * 1024 * 1024);
	});

	it.each([
		['no files', () => []],
		['six files', () => Array.from({ length: 6 }, () => jpeg())],
		['a gif', () => [jpeg(16, 'image/gif')]],
		['an oversized file', () => [jpeg(IDENTIFY_MAX_BYTES + 1)]],
		['a non-file entry', () => ['not a file']]
	])('rejects %s with 400 bad_request and no outbound call', async (_name, files) => {
		const fetchFn = spyFetch(plantNetOk);
		const result = await handleIdentify(editor, files(), KEY, fetchFn);
		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({ ok: false, code: 'bad_request' });
		expect(fetchFn).not.toHaveBeenCalled();
		expect(await usage(editorId)).toBe(0);
	});

	it('accepts exactly 5 files of exactly 2 MB', async () => {
		const fetchFn = spyFetch(plantNetOk);
		const files = Array.from({ length: 5 }, () => jpeg(IDENTIFY_MAX_BYTES, 'image/png'));
		const result = await handleIdentify(editor, files, KEY, fetchFn);
		expect(result.status).toBe(200);
	});

	it('returns 503 not_configured without a key and does not consume quota', async () => {
		const fetchFn = spyFetch(plantNetOk);
		for (const key of [undefined, '']) {
			const result = await handleIdentify(editor, [jpeg()], key, fetchFn);
			expect(result.status).toBe(503);
			expect(result.body).toMatchObject({ ok: false, code: 'not_configured' });
		}
		expect(fetchFn).not.toHaveBeenCalled();
		expect(await usage(editorId)).toBe(0);
	});
});

describe('handleIdentify authorization and quota', () => {
	it('returns 403 forbidden for a viewer and never calls Pl@ntNet', async () => {
		const fetchFn = spyFetch(plantNetOk);
		const result = await handleIdentify(viewer, [jpeg()], KEY, fetchFn);
		expect(result.status).toBe(403);
		expect(result.body).toMatchObject({ ok: false, code: 'forbidden' });
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('returns 429 quota once the daily limit of 100 is used and never calls Pl@ntNet', async () => {
		const day = new Date().toISOString().slice(0, 10);
		const { error } = await adminClient().from('api_usage').upsert({ user_id: editorId, day, count: 100 });
		if (error) throw error;
		const fetchFn = spyFetch(plantNetOk);
		const result = await handleIdentify(editor, [jpeg()], KEY, fetchFn);
		expect(result.status).toBe(429);
		expect(result.body).toMatchObject({ ok: false, code: 'quota' });
		expect(fetchFn).not.toHaveBeenCalled();
		expect(await usage(editorId)).toBe(100);
	});

	it('returns 502 upstream when the quota RPC fails', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const broken = { rpc: async () => ({ data: null, error: { message: 'boom' } }) } as unknown as SupabaseClient<Database>;
		const fetchFn = spyFetch(plantNetOk);
		const result = await handleIdentify(broken, [jpeg()], KEY, fetchFn);
		spy.mockRestore();
		expect(result.status).toBe(502);
		expect(result.body).toMatchObject({ ok: false, code: 'upstream' });
		expect(fetchFn).not.toHaveBeenCalled();
	});
});

describe('handleIdentify for an editor', () => {
	it('returns 200 with candidates and consumes one unit of quota', async () => {
		const fetchFn = spyFetch(plantNetOk);
		const result = await handleIdentify(editor, [jpeg(), jpeg()], KEY, fetchFn);
		expect(result.status).toBe(200);
		expect(result.body).toMatchObject({ ok: true, candidates: [{ scientific_name: 'Bellis perennis' }] });
		expect(fetchFn).toHaveBeenCalledOnce();
		expect(await usage(editorId)).toBe(1);
	});

	it('maps Pl@ntNet 404 to 200 no_match', async () => {
		const result = await handleIdentify(editor, [jpeg()], KEY, spyFetch(() => new Response('{}', { status: 404 })));
		expect(result.status).toBe(200);
		expect(result.body).toMatchObject({ ok: false, code: 'no_match' });
	});

	it('maps Pl@ntNet 429 to 429 quota', async () => {
		const result = await handleIdentify(editor, [jpeg()], KEY, spyFetch(() => new Response('{}', { status: 429 })));
		expect(result.status).toBe(429);
		expect(result.body).toMatchObject({ ok: false, code: 'quota' });
	});

	it('maps a network failure to 502 upstream', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const fetchFn = vi.fn<typeof fetch>(async () => {
			throw new Error('offline');
		});
		const result = await handleIdentify(editor, [jpeg()], KEY, fetchFn);
		spy.mockRestore();
		expect(result.status).toBe(502);
		expect(result.body).toMatchObject({ ok: false, code: 'upstream' });
	});
});
