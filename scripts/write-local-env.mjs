import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const status = JSON.parse(
	execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' })
);
const lines = [
	`PUBLIC_SUPABASE_URL=${status.API_URL}`,
	`PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
	'# Local stack only: used by integration and e2e tests, never by the app.',
	`SUPABASE_SECRET_KEY=${status.SECRET_KEY}`
];
writeFileSync('.env', `${lines.join('\n')}\n`);
console.log('Wrote .env for the local Supabase stack.');
