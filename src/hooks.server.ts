import { error, redirect, type Handle, type HandleServerError } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { isPublicPath } from '$lib/auth/guard';
import { parsePublicEnv } from '$lib/env';
import { createSupabaseServerClient } from '$lib/supabase/server';

export const handle: Handle = async ({ event, resolve }) => {
	const publicEnv = parsePublicEnv(env);
	event.locals.supabase = createSupabaseServerClient(event, publicEnv);

	const { data, error: authError } = await event.locals.supabase.auth.getUser();
	if (
		authError &&
		authError.name !== 'AuthSessionMissingError' &&
		(authError.status === undefined || authError.status === 0 || authError.status >= 500)
	) {
		console.error('auth.getUser failed', authError);
		error(503, 'Услугата за вход не отговаря. Опитай пак след малко.');
	}
	event.locals.user = data.user ?? null;

	if (!event.locals.user && !isPublicPath(event.url.pathname)) {
		const next = encodeURIComponent(event.url.pathname + event.url.search);
		redirect(303, `/login?next=${next}`);
	}

	return resolve(event);
};

export const handleError: HandleServerError = ({ error: err, event, status }) => {
	if (status === 404) return { message: 'Страницата не е намерена.' };
	console.error(`Unhandled error (${status}) on ${event.url.pathname}`, err);
	return { message: 'Възникна неочаквана грешка.' };
};
