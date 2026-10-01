import { fail, redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/auth/guard';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, '/');
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		if (!email || !password) {
			return fail(400, { email, message: 'Въведи имейл и парола.' });
		}
		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (error) {
			return fail(400, { email, message: 'Грешен имейл или парола.' });
		}
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
