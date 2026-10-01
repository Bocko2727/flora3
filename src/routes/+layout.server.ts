import { isEditor } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) return { user: null, isEditor: false };
	return {
		user: { id: locals.user.id, email: locals.user.email ?? '' },
		isEditor: await isEditor(locals.supabase)
	};
};
