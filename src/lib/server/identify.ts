import { fail, type IdentifyResult } from '$lib/identify/types';
import { identifyWithPlantNet } from '$lib/server/external/plantnet';
import type { Db } from '$lib/server/plants';

export const IDENTIFY_MAX_FILES = 5;
export const IDENTIFY_MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png']);

type Outcome = { status: number; body: IdentifyResult };

const STATUS: Record<string, number> = {
	quota: 429,
	not_configured: 503,
	upstream: 502,
	bad_request: 400,
	forbidden: 403
};

function reply(body: IdentifyResult): Outcome {
	return { status: body.ok ? 200 : (STATUS[body.code] ?? 200), body };
}

function validFiles(files: unknown[]): files is Blob[] {
	return (
		files.length >= 1 &&
		files.length <= IDENTIFY_MAX_FILES &&
		files.every((f) => f instanceof Blob && ALLOWED_TYPES.has(f.type) && f.size <= IDENTIFY_MAX_BYTES)
	);
}

export async function handleIdentify(
	db: Db,
	files: unknown[],
	apiKey: string | undefined,
	fetchFn: typeof fetch = fetch
): Promise<Outcome> {
	if (!validFiles(files)) return reply(fail('bad_request'));
	if (!apiKey) return reply(fail('not_configured'));

	const quota = await db.rpc('consume_identify_quota');
	if (quota.error) {
		console.error('consume_identify_quota failed', quota.error);
		return reply(fail('upstream'));
	}
	if (quota.data !== true) {
		const editor = await db.rpc('is_editor');
		if (editor.error) {
			console.error('is_editor failed', editor.error);
			return reply(fail('upstream'));
		}
		return reply(fail(editor.data === true ? 'quota' : 'forbidden'));
	}

	return reply(await identifyWithPlantNet(files, apiKey, fetchFn));
}
