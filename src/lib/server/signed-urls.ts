import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';
import { UserFacingError } from '$lib/errors';

export const SIGNED_URL_SECONDS = 3600;

export async function signPaths(db: SupabaseClient<Database>, paths: string[]): Promise<Map<string, string>> {
	const unique = [...new Set(paths.filter((path) => path !== ''))];
	const urls = new Map<string, string>();
	if (unique.length === 0) return urls;
	const { data, error } = await db.storage.from('photos').createSignedUrls(unique, SIGNED_URL_SECONDS);
	if (error) throw new UserFacingError('Снимките не можаха да се заредят.', error);
	for (const item of data) {
		if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
	}
	const missing = unique.filter((path) => !urls.has(path));
	if (missing.length > 0) console.error('No signed URL for photo paths:', missing);
	return urls;
}
