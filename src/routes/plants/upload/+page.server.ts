import { UserFacingError } from '$lib/errors';
import { requireEditor } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireEditor(locals);
	// Only names and ids, to warn about a plant that is already in the catalog.
	const { data, error } = await locals.supabase.from('plants').select('id, scientific_name');
	if (error) throw new UserFacingError('Каталогът не можа да се зареди.', error);
	return { catalog: data };
};
