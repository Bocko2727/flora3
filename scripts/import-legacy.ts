import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../src/lib/database.types';
import { importLegacy } from './import/run';

const { values } = parseArgs({
	options: {
		source: { type: 'string' },
		apply: { type: 'boolean', default: false },
		report: { type: 'string', default: 'import-report.json' }
	}
});

if (!values.source) {
	console.error('Usage: npm run import:legacy -- --source legacy-export.json [--apply] [--report import-report.json]');
	process.exit(2);
}

try {
	process.loadEnvFile('.env.import');
} catch {
	// variables may come from the shell instead
}

const envResult = z
	.object({ NEW_SUPABASE_URL: z.url(), NEW_SUPABASE_SECRET_KEY: z.string().min(20), OWNER_USER_ID: z.uuid() })
	.safeParse(process.env);
if (!envResult.success) {
	console.error(`Missing or invalid: ${envResult.error.issues.map((i) => i.path.join('.')).join(', ')} (put them in .env.import)`);
	process.exit(2);
}
const env = envResult.data;

const parsed: unknown = JSON.parse(readFileSync(values.source, 'utf8'));
const records = Array.isArray(parsed)
	? parsed
	: typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { plants?: unknown }).plants)
		? (parsed as { plants: unknown[] }).plants
		: null;
if (!records) {
	console.error('The source file must be a JSON array of plants or an object with a "plants" array.');
	process.exit(2);
}

const db = createClient<Database>(env.NEW_SUPABASE_URL, env.NEW_SUPABASE_SECRET_KEY, {
	auth: { persistSession: false, autoRefreshToken: false }
});

console.log(values.apply ? 'APPLY mode: writing to the new project.' : 'DRY-RUN: nothing will be written.');
const report = await importLegacy({ records, db, ownerId: env.OWNER_USER_ID, apply: values.apply, log: console.log });
writeFileSync(values.report, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ plants: report.plants, photos: report.photos, errors: report.errors.length }, null, 2));
console.log(`Full report: ${values.report}`);
process.exit(report.errors.length > 0 ? 1 : 0);
