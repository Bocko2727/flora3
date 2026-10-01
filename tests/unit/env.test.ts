import { describe, expect, it } from 'vitest';
import { parsePublicEnv } from '$lib/env';

describe('parsePublicEnv', () => {
	it('returns both values when they are valid', () => {
		const env = parsePublicEnv({
			PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
		});
		expect(env.PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
		expect(env.PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe('sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH');
	});

	it('names every missing variable in a Bulgarian message', () => {
		expect(() => parsePublicEnv({})).toThrow(
			/Липсваща или невалидна конфигурация: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY/
		);
	});

	it('rejects a URL that is not a URL', () => {
		expect(() =>
			parsePublicEnv({
				PUBLIC_SUPABASE_URL: 'not a url',
				PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'
			})
		).toThrow(/PUBLIC_SUPABASE_URL/);
	});

	it('ignores unrelated variables', () => {
		const env = parsePublicEnv({
			PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
			PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
			OTHER: 'x'
		});
		expect(Object.keys(env).sort()).toEqual([
			'PUBLIC_SUPABASE_PUBLISHABLE_KEY',
			'PUBLIC_SUPABASE_URL'
		]);
	});
});
