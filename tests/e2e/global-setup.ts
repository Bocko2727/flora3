import { EDITOR, VIEWER, ensureUser, resetCatalog } from '../helpers/supabase';

export default async function globalSetup() {
	await ensureUser(EDITOR, { editor: true });
	await ensureUser(VIEWER, { editor: false });
	await resetCatalog();
}
