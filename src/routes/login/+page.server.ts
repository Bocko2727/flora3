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
			if (error.code === 'invalid_credentials' || error.status === 400) {
				return fail(400, { email, message: 'Грешен имейл или парола.' });
			}
			if (error.status === 429) {
				return fail(429, { email, message: 'Твърде много опити. Изчакай малко и опитай пак.' });
			}
			console.error('signInWithPassword failed', error);
			return fail(503, { email, message: 'Услугата за вход не отговаря. Опитай пак след малко.' });
		}
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
