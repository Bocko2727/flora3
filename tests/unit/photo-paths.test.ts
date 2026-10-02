import { describe, expect, it } from 'vitest';
import { photoPaths } from '$lib/photos/storage';

describe('photoPaths', () => {
	it('builds owner/plant/photo paths with the extension of the mime', () => {
		expect(photoPaths('o', 'p', 'f', 'image/webp')).toEqual({ path: 'o/p/f.webp', thumbPath: 'o/p/f_thumb.webp' });
		expect(photoPaths('o', 'p', 'f', 'image/jpeg')).toEqual({ path: 'o/p/f.jpg', thumbPath: 'o/p/f_thumb.jpg' });
	});
});
