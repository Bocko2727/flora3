import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';

try {
	process.loadEnvFile('.env');
} catch {
	// CI may provide env vars directly
}

const url = process.env.PUBLIC_SUPABASE_URL;
const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) {
	throw new Error('Run `npm run db:start && npm run env:local` before integration/e2e tests.');
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
	throw new Error(`Refusing to run destructive test helpers against non-local Supabase: ${url}`);
}

export type TestUser = { email: string; password: string };
export const EDITOR: TestUser = { email: 'editor@flora.test', password: 'flora-editor-password-1' };
export const VIEWER: TestUser = { email: 'viewer@flora.test', password: 'flora-viewer-password-1' };

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient<Database> {
	return createClient<Database>(url!, secretKey!, noSession);
}

export async function ensureUser(user: TestUser, options: { editor: boolean }): Promise<string> {
	const admin = adminClient();
	const created = await admin.auth.admin.createUser({
		email: user.email,
		password: user.password,
		email_confirm: true
	});
	let id = created.data.user?.id;
	if (!id) {
		const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
		if (error) throw error;
		id = data.users.find((u) => u.email === user.email)?.id;
		if (!id) throw created.error ?? new Error(`Could not create ${user.email}`);
		await admin.auth.admin.updateUserById(id, { password: user.password });
	}
	if (options.editor) {
		const { error } = await admin.from('editors').upsert({ user_id: id });
		if (error) throw error;
	} else {
		const { error } = await admin.from('editors').delete().eq('user_id', id);
		if (error) throw error;
	}
	return id;
}

export async function signedInClient(user: TestUser): Promise<SupabaseClient<Database>> {
	const client = createClient<Database>(url!, publishableKey!, noSession);
	const { error } = await client.auth.signInWithPassword(user);
	if (error) throw error;
	return client;
}

async function emptyBucket(admin: SupabaseClient<Database>): Promise<void> {
	const bucket = admin.storage.from('photos');
	const { data: owners, error } = await bucket.list('', { limit: 1000 });
	if (error) throw error;
	for (const owner of owners) {
		const { data: plants } = await bucket.list(owner.name, { limit: 1000 });
		for (const plant of plants ?? []) {
			const prefix = `${owner.name}/${plant.name}`;
			const { data: files } = await bucket.list(prefix, { limit: 1000 });
			const paths = (files ?? []).map((file) => `${prefix}/${file.name}`);
			if (paths.length) {
				const { error: removeError } = await bucket.remove(paths);
				if (removeError) throw removeError;
			}
		}
	}
}

export async function resetCatalog(): Promise<void> {
	const admin = adminClient();
	const photos = await admin.from('plant_photos').delete().not('id', 'is', null);
	if (photos.error) throw photos.error;
	const plants = await admin.from('plants').delete().not('id', 'is', null);
	if (plants.error) throw plants.error;
	await emptyBucket(admin);
}
