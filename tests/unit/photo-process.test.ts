import { describe, expect, it } from 'vitest';
import { UserFacingError } from '$lib/errors';
import {
	MAX_INPUT_BYTES,
	encodeAs,
	encodeCanvas,
	fitWithin,
	sha256Hex,
	toIsoDate,
	validateInputFile,
	type BlobEncoder
} from '$lib/photos/process';

const canvas = {} as HTMLCanvasElement;
const blobOf = (type: string) => new Blob([new Uint8Array([1, 2, 3])], { type });

describe('fitWithin', () => {
	it('scales landscape and portrait images to the longest side', () => {
		expect(fitWithin(4032, 3024, 2560)).toEqual({ width: 2560, height: 1920 });
		expect(fitWithin(3024, 4032, 2560)).toEqual({ width: 1920, height: 2560 });
		expect(fitWithin(4032, 3024, 480)).toEqual({ width: 480, height: 360 });
	});
	it('never upscales', () => {
		expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 });
	});
	it('keeps at least one pixel on extreme ratios', () => {
		expect(fitWithin(10000, 10, 2560)).toEqual({ width: 2560, height: 3 });
		expect(fitWithin(100000, 1, 480)).toEqual({ width: 480, height: 1 });
	});
});

describe('validateInputFile', () => {
	it('accepts images up to 30 MB', () => {
		expect(validateInputFile({ type: 'image/jpeg', size: MAX_INPUT_BYTES })).toBeNull();
		expect(validateInputFile({ type: 'image/heic', size: 1000 })).toBeNull();
	});
	it('rejects non-images, empty and oversized files', () => {
		expect(validateInputFile({ type: 'application/pdf', size: 10 })).toBe('Файлът не е изображение.');
		expect(validateInputFile({ type: 'image/jpeg', size: 0 })).toBe('Файлът е празен.');
		expect(validateInputFile({ type: 'image/jpeg', size: MAX_INPUT_BYTES + 1 })).toBe('Файлът е над 30 MB.');
	});
});

describe('sha256Hex', () => {
	it('hashes bytes to lowercase hex', async () => {
		const bytes = new TextEncoder().encode('abc');
		expect(await sha256Hex(bytes.buffer as ArrayBuffer)).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});
});

describe('toIsoDate', () => {
	it('converts valid dates and rejects everything else', () => {
		expect(toIsoDate(new Date('2024-05-01T10:00:00Z'))).toBe('2024-05-01T10:00:00.000Z');
		expect(toIsoDate(new Date('nope'))).toBeNull();
		expect(toIsoDate('2024-05-01')).toBeNull();
		expect(toIsoDate(undefined)).toBeNull();
	});
});

describe('encodeCanvas', () => {
	it('uses WebP when the browser produces WebP', async () => {
		const encode: BlobEncoder = async (_c, type) => blobOf(type);
		const result = await encodeCanvas(canvas, encode);
		expect(result.mime).toBe('image/webp');
		expect(result.blob.type).toBe('image/webp');
	});

	it('falls back to JPEG when WebP is not produced', async () => {
		const requested: string[] = [];
		const encode: BlobEncoder = async (_c, type, quality) => {
			requested.push(`${type}@${quality}`);
			return type === 'image/webp' ? blobOf('image/png') : blobOf(type);
		};
		const result = await encodeCanvas(canvas, encode);
		expect(result.mime).toBe('image/jpeg');
		expect(requested).toEqual(['image/webp@0.85', 'image/jpeg@0.85']);
	});

	it('throws a Bulgarian error when nothing can be encoded', async () => {
		const encode: BlobEncoder = async () => null;
		await expect(encodeCanvas(canvas, encode)).rejects.toThrow(
			new UserFacingError('Браузърът не може да обработи тази снимка.')
		);
	});
});

describe('encodeAs', () => {
	it('returns a blob of the requested mime', async () => {
		const blob = await encodeAs(canvas, 'image/jpeg', async (_c, type) => blobOf(type));
		expect(blob.type).toBe('image/jpeg');
	});
	it('throws when the browser returns another type', async () => {
		await expect(encodeAs(canvas, 'image/webp', async () => blobOf('image/png'))).rejects.toBeInstanceOf(
			UserFacingError
		);
	});
});
