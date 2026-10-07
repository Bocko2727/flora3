import { describe, expect, it } from 'vitest';
import { enhancedPath, photoPaths } from '$lib/photos/storage';

describe('photoPaths', () => {
	it('builds owner/plant/photo paths with the extension of the mime', () => {
		expect(photoPaths('o', 'p', 'f', 'image/webp')).toEqual({ path: 'o/p/f.webp', thumbPath: 'o/p/f_thumb.webp' });
		expect(photoPaths('o', 'p', 'f', 'image/jpeg')).toEqual({ path: 'o/p/f.jpg', thumbPath: 'o/p/f_thumb.jpg' });
	});
});

describe('enhancedPath', () => {
	it('is a separate jpeg next to the original, whatever the original format', () => {
		expect(enhancedPath('o/p/f.webp')).toBe('o/p/f_enh.jpg');
		expect(enhancedPath('o/p/f.jpg')).toBe('o/p/f_enh.jpg');
	});

	it('can never be the original or its thumbnail', () => {
		for (const mime of ['image/webp', 'image/jpeg'] as const) {
			const { path, thumbPath } = photoPaths('o', 'p', 'f', mime);
			expect(enhancedPath(path)).not.toBe(path);
			expect(enhancedPath(path)).not.toBe(thumbPath);
		}
	});

	it('refuses anything that is not an original photo path (including an enhanced one)', () => {
		expect(() => enhancedPath('')).toThrow();
		expect(() => enhancedPath('f.jpg')).toThrow();
		expect(() => enhancedPath('o/p/f_enh.jpg')).toThrow();
		expect(() => enhancedPath('o/p/f_thumb.jpg')).toThrow();
		expect(() => enhancedPath('o/p/f.png')).toThrow();
	});
});
