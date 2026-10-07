import { UserFacingError } from '$lib/errors';
import { enhancePixels } from '$lib/photos/enhance';
import { decodeBitmap, fitWithin } from '$lib/photos/process';

// Browser only (canvas, createImageBitmap).

export const ENHANCE_MAX_EDGE = 2000;
export const ENHANCE_QUALITY = 0.92;
export const ENHANCE_MAX_PHOTOS = 10;

/** Levels + light sharpening on a decoded copy. The source blob is never modified; EXIF is dropped by the canvas. */
export async function enhanceImage(source: Blob): Promise<Blob> {
	const fail = () => new UserFacingError('Снимката не можа да се подобри. Оригиналът е непокътнат.');
	const bitmap = await decodeBitmap(source);
	const canvas = document.createElement('canvas');
	try {
		const size = fitWithin(bitmap.width, bitmap.height, ENHANCE_MAX_EDGE);
		canvas.width = size.width;
		canvas.height = size.height;
		const context = canvas.getContext('2d', { willReadFrequently: true });
		if (!context) throw fail();
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';
		context.drawImage(bitmap, 0, 0, size.width, size.height);
		const pixels = context.getImageData(0, 0, size.width, size.height);
		enhancePixels(pixels.data, size.width, size.height);
		context.putImageData(pixels, 0, 0);
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', ENHANCE_QUALITY));
		if (!blob || blob.type !== 'image/jpeg') throw fail();
		return blob;
	} finally {
		canvas.width = 0;
		canvas.height = 0;
		bitmap.close();
	}
}
