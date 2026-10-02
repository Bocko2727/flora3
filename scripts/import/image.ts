import { createHash } from 'node:crypto';
import exifr from 'exifr';
import sharp from 'sharp';

export const FULL_MAX = 2560;
export const THUMB_MAX = 480;
export const WEBP_QUALITY = 85;

export type LegacyImage = { full: Buffer; thumb: Buffer; width: number; height: number; sha256: string; takenAt: string | null };

function resize(original: Buffer, max: number) {
	return sharp(original)
		.rotate()
		.resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: WEBP_QUALITY });
}

async function readTakenAt(original: Buffer): Promise<string | null> {
	try {
		const exif = await exifr.parse(original, { pick: ['DateTimeOriginal'] });
		const value = exif?.DateTimeOriginal;
		return value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : null;
	} catch {
		return null;
	}
}

export async function processLegacyImage(original: Buffer): Promise<LegacyImage> {
	const sha256 = createHash('sha256').update(original).digest('hex');
	const full = await resize(original, FULL_MAX).toBuffer({ resolveWithObject: true });
	const thumb = await resize(original, THUMB_MAX).toBuffer();
	return {
		full: full.data,
		thumb,
		width: full.info.width,
		height: full.info.height,
		sha256,
		takenAt: await readTakenAt(original)
	};
}
