import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../src/lib/database.types';
import { applyOverrides, parseOverrides } from './import/overrides';
import { emptyReport, importLegacy, verifyOwner } from './import/run';

const { values } = parseArgs({
	options: {
		source: { type: 'string' },
		apply: { type: 'boolean', default: false },
		overrides: { type: 'string' },
		report: { type: 'string', default: 'import-report.json' }
	}
});

if (!values.source) {
	console.error('Usage: npm run import:legacy -- --source legacy-export.json [--overrides overrides.json] [--apply] [--report import-report.json]');
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

let parsed: unknown;
try {
	parsed = JSON.parse(readFileSync(values.source, 'utf8'));
} catch (e) {
	console.error(`Cannot read ${values.source} as JSON: ${e instanceof Error ? e.message : String(e)}`);
	process.exit(2);
}
const sourceRecords = Array.isArray(parsed)
	? parsed
	: typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { plants?: unknown }).plants)
		? (parsed as { plants: unknown[] }).plants
		: null;
if (!sourceRecords) {
	console.error('The source file must be a JSON array of plants or an object with a "plants" array.');
	process.exit(2);
}

let records: unknown[] = sourceRecords;
let overridesApplied: string[] = [];
if (values.overrides) {
	try {
		const result = applyOverrides(sourceRecords, parseOverrides(JSON.parse(readFileSync(values.overrides, 'utf8'))));
		records = result.records;
		overridesApplied = result.applied;
	} catch (e) {
		console.error(`Invalid overrides ${values.overrides}: ${e instanceof Error ? e.message : String(e)}`);
		process.exit(2);
	}
}

const db = createClient<Database>(env.NEW_SUPABASE_URL, env.NEW_SUPABASE_SECRET_KEY, {
	auth: { persistSession: false, autoRefreshToken: false }
});

let owner: { email: string };
try {
	owner = await verifyOwner(db, env.OWNER_USER_ID);
} catch (e) {
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(2);
}
console.log(`Target: ${new URL(env.NEW_SUPABASE_URL).host}`);
console.log(`Owner: ${owner.email}`);
for (const line of overridesApplied) console.log(`Override: ${line}`);
console.log(values.apply ? 'APPLY mode: writing to the new project.' : 'DRY-RUN: nothing will be written.');
const report = emptyReport(values.apply);
try {
	await importLegacy({ records, db, ownerId: env.OWNER_USER_ID, apply: values.apply, log: console.log, report });
} catch (e) {
	// Keep what was done so far, then fail loudly.
	report.errors.push({ plantId: null, message: `Aborted: ${e instanceof Error ? e.message : String(e)}` });
	writeFileSync(values.report, JSON.stringify({ overridesApplied, ...report }, null, 2));
	console.error(`Import aborted; partial report: ${values.report}`);
	throw e;
}
writeFileSync(values.report, JSON.stringify({ overridesApplied, ...report }, null, 2));
const duplicates = report.skipped.filter((s) => s.reason === 'duplicate-of-other-plant');
console.log(
	JSON.stringify(
		{
			plants: report.plants,
			photos: report.photos,
			errors: report.errors.length,
			plantsWithoutPhotos: report.plantsWithoutPhotos,
			duplicatesOfOtherPlants: duplicates.map((d) => ({ plantId: d.plantId, existingPlantId: d.existingPlantId, url: d.url }))
		},
		null,
		2
	)
);
console.log(`Full report: ${values.report}`);
process.exit(report.errors.length > 0 || report.plantsWithoutPhotos.length > 0 || duplicates.length > 0 ? 1 : 0);
