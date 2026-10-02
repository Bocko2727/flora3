import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';

export async function isEditor(db: SupabaseClient<Database>): Promise<boolean> {
	const { data, error: rpcError } = await db.rpc('is_editor');
	if (rpcError) {
		console.error('is_editor failed', rpcError);
		error(503, 'Не успяхме да проверим правата ти. Опитай пак.');
	}
	return data === true;
}

export async function requireEditor(locals: App.Locals): Promise<void> {
	if (!locals.user || !(await isEditor(locals.supabase))) {
		error(403, 'Нямаш права за това действие.');
	}
}
