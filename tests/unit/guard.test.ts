import { describe, expect, it } from 'vitest';
import { isPublicPath, safeNext } from '$lib/auth/guard';

describe('isPublicPath', () => {
	it('treats /login and its sub-paths as public', () => {
		expect(isPublicPath('/login')).toBe(true);
		expect(isPublicPath('/login/')).toBe(true);
	});
	it('protects everything else', () => {
		expect(isPublicPath('/')).toBe(false);
		expect(isPublicPath('/plants/new')).toBe(false);
		expect(isPublicPath('/loginx')).toBe(false);
		expect(isPublicPath('/logout')).toBe(false);
	});
});

describe('safeNext', () => {
	it('keeps same-site relative paths', () => {
		expect(safeNext('/plants/abc?x=1')).toBe('/plants/abc?x=1');
	});
	it('falls back to / for missing, absolute or protocol-relative targets', () => {
		expect(safeNext(null)).toBe('/');
		expect(safeNext('')).toBe('/');
		expect(safeNext('https://evil.example')).toBe('/');
		expect(safeNext('//evil.example')).toBe('/');
		expect(safeNext('/\\evil.example')).toBe('/');
	});
});
