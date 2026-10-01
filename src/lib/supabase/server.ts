import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import type { Database } from '$lib/database.types';
import type { PublicEnv } from '$lib/env';

export function createSupabaseServerClient(
	event: Pick<RequestEvent, 'cookies' | 'fetch'>,
	env: PublicEnv
): SupabaseClient<Database> {
	return createServerClient<Database>(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				// @supabase/ssr sends httpOnly: false so the browser client can read the session
				// for direct Storage uploads. Spreading `options` keeps that.
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		},
		global: { fetch: event.fetch }
	});
}
