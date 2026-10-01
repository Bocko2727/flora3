import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { isPublicPath } from '$lib/auth/guard';
import { parsePublicEnv } from '$lib/env';
import { createSupabaseServerClient } from '$lib/supabase/server';

export const handle: Handle = async ({ event, resolve }) => {
	const publicEnv = parsePublicEnv(env);
	event.locals.supabase = createSupabaseServerClient(event, publicEnv);

	const { data } = await event.locals.supabase.auth.getUser();
	event.locals.user = data.user ?? null;

	if (!event.locals.user && !isPublicPath(event.url.pathname)) {
		const next = encodeURIComponent(event.url.pathname + event.url.search);
		redirect(303, `/login?next=${next}`);
	}

	return resolve(event);
};
