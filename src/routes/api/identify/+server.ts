import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireEditor } from '$lib/server/auth';
import { externalFetch } from '$lib/server/external/fetch';
import { handleIdentify } from '$lib/server/identify';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireEditor(locals);

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		error(400, 'Снимките не можаха да се изпратят. Опитай пак.');
	}

	const { status, body } = await handleIdentify(
		locals.supabase,
		form.getAll('images'),
		env.PLANTNET_API_KEY,
		externalFetch()
	);
	return json(body, { status });
};
