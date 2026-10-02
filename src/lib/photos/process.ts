import { UserFacingError } from '$lib/errors';

export const FULL_MAX = 2560;
export const THUMB_MAX = 480;
export const QUALITY = 0.85;
export const MAX_INPUT_BYTES = 30 * 1024 * 1024;
export const MAX_FILES_PER_BATCH = 10;

export type PhotoMime = 'image/webp' | 'image/jpeg';

export type ProcessedPhoto = {
	full: Blob;
	thumb: Blob;
	mime: PhotoMime;
	width: number;
	height: number;
	sha256: string;
	takenAt: string | null;
};

export type BlobEncoder = (canvas: HTMLCanvasElement, type: string, quality: number) => Promise<Blob | null>;

export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
	if (width <= max && height <= max) return { width, height };
	const scale = max / Math.max(width, height);
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

export function validateInputFile(file: { type: string; size: number }): string | null {
	if (!file.type.startsWith('image/')) return 'Файлът не е изображение.';
	if (file.size === 0) return 'Файлът е празен.';
	if (file.size > MAX_INPUT_BYTES) return 'Файлът е над 30 MB.';
	return null;
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Null for non-dates, invalid dates and implausible years (exifr turns an all-zero EXIF date into 1899-11-30). */
export function toIsoDate(value: unknown): string | null {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
	return value.getUTCFullYear() < 1900 ? null : value.toISOString();
}

const canvasToBlob: BlobEncoder = (canvas, type, quality) =>
	new Promise((resolve) => canvas.toBlob(resolve, type, quality));

export async function encodeAs(
	canvas: HTMLCanvasElement,
	mime: PhotoMime,
	encode: BlobEncoder = canvasToBlob
): Promise<Blob> {
	const blob = await encode(canvas, mime, QUALITY);
	if (!blob || blob.type !== mime) {
		throw new UserFacingError('Браузърът не може да обработи тази снимка.');
	}
	return blob;
}

export async function encodeCanvas(
	canvas: HTMLCanvasElement,
	encode: BlobEncoder = canvasToBlob
): Promise<{ blob: Blob; mime: PhotoMime }> {
	for (const mime of ['image/webp', 'image/jpeg'] as const) {
		const blob = await encode(canvas, mime, QUALITY);
		if (blob && blob.type === mime) return { blob, mime };
	}
	throw new UserFacingError('Браузърът не може да обработи тази снимка.');
}

async function readTakenAt(buffer: ArrayBuffer): Promise<string | null> {
	try {
		const exifr = (await import('exifr')).default;
		const exif = await exifr.parse(buffer, { pick: ['DateTimeOriginal'] });
		return toIsoDate(exif?.DateTimeOriginal);
	} catch {
		return null;
	}
}

function drawScaled(bitmap: ImageBitmap, size: { width: number; height: number }): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext('2d');
	if (!context) throw new UserFacingError('Браузърът не може да обработи тази снимка.');
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = 'high';
	context.drawImage(bitmap, 0, 0, size.width, size.height);
	return canvas;
}

/** Drops the canvas backing store right away instead of waiting for garbage collection (matters on iOS Safari). */
function releaseCanvas(canvas: HTMLCanvasElement): void {
	canvas.width = 0;
	canvas.height = 0;
}

const UNSUPPORTED_FORMAT = 'Форматът не се поддържа от този браузър. Изберете JPEG.';

/**
 * Decodes with EXIF orientation applied. Engines that reject the `imageOrientation` option throw a TypeError;
 * only then is the decode retried once without options. Any other failure means the format is unsupported.
 */
export async function decodeBitmap(
	file: Blob,
	create: typeof createImageBitmap = createImageBitmap
): Promise<ImageBitmap> {
	try {
		try {
			return await create(file, { imageOrientation: 'from-image' });
		} catch (error) {
			if (!(error instanceof TypeError)) throw error;
			return await create(file);
		}
	} catch {
		throw new UserFacingError(UNSUPPORTED_FORMAT);
	}
}

/** Browser only. Hashes the original, reads the capture date, re-encodes full + thumb without metadata. */
export async function processImage(file: File): Promise<ProcessedPhoto> {
	const buffer = await file.arrayBuffer();
	const sha256 = await sha256Hex(buffer);
	const takenAt = await readTakenAt(buffer);

	const bitmap = await decodeBitmap(file);
	const canvases: HTMLCanvasElement[] = [];
	try {
		const fullSize = fitWithin(bitmap.width, bitmap.height, FULL_MAX);
		const fullCanvas = drawScaled(bitmap, fullSize);
		canvases.push(fullCanvas);
		const full = await encodeCanvas(fullCanvas);
		const thumbCanvas = drawScaled(bitmap, fitWithin(bitmap.width, bitmap.height, THUMB_MAX));
		canvases.push(thumbCanvas);
		const thumb = await encodeAs(thumbCanvas, full.mime);
		return { full: full.blob, thumb, mime: full.mime, width: fullSize.width, height: fullSize.height, sha256, takenAt };
	} finally {
		for (const canvas of canvases) releaseCanvas(canvas);
		bitmap.close();
	}
}
