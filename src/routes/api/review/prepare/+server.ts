import { json } from '@sveltejs/kit';
import { UserFacingError } from '$lib/errors';
import { reviewInputSchema } from '$lib/identify/types';
import { requireEditor } from '$lib/server/auth';
import { externalFetch } from '$lib/server/external/fetch';
import { prepareReview } from '$lib/server/review';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	await requireEditor(locals);
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Невалидна заявка.' }, { status: 400 });
	}
	const parsed = reviewInputSchema.safeParse(body);
	if (!parsed.success) return json({ message: 'Невалидна заявка.' }, { status: 400 });
	const { plantId, ...ident } = parsed.data;
	try {
		const status = await prepareReview(locals.supabase, plantId, ident, externalFetch());
		return json({ status });
	} catch (e) {
		if (e instanceof UserFacingError) return json({ message: e.message }, { status: 400 });
		throw e;
	}
};
