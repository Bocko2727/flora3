import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';
import type { Database } from '$lib/database.types';
import { parsePublicEnv } from '$lib/env';

let client: SupabaseClient<Database> | undefined;

export function getBrowserSupabase(): SupabaseClient<Database> {
	if (!client) {
		const publicEnv = parsePublicEnv(env);
		client = createBrowserClient<Database>(
			publicEnv.PUBLIC_SUPABASE_URL,
			publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY
		);
	}
	return client;
}
