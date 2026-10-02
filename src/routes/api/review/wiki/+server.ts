import { json } from '@sveltejs/kit';
import { requireEditor } from '$lib/server/auth';
import { externalFetch } from '$lib/server/external/fetch';
import { findWiki } from '$lib/server/external/wiki';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	await requireEditor(locals);
	const key = Number(url.searchParams.get('key'));
	if (!Number.isSafeInteger(key) || key <= 0) return json({ message: 'Невалиден ключ.' }, { status: 400 });
	return json({ wiki: await findWiki(key, externalFetch()) });
};
