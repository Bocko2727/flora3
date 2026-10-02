import { UserFacingError } from '$lib/errors';
import { decodeBitmap, fitWithin } from '$lib/photos/process';
import { IDENTIFY_MESSAGES, fail, type IdentifyErrorCode, type IdentifyResult } from './types';

// Browser only (canvas, createImageBitmap, fetch with relative URL).

export const IDENTIFY_MAX_EDGE = 1024;
export const IDENTIFY_QUALITY = 0.8;
export const IDENTIFY_MAX_IMAGES = 5;

/** Downscales to a JPEG small enough for the identify endpoint (EXIF orientation applied, metadata dropped). */
export async function toIdentifyJpeg(source: Blob): Promise<Blob> {
	const bad = () => new UserFacingError(IDENTIFY_MESSAGES.bad_request);
	let bitmap: ImageBitmap;
	try {
		bitmap = await decodeBitmap(source);
	} catch {
		throw bad();
	}
	const canvas = document.createElement('canvas');
	try {
		const size = fitWithin(bitmap.width, bitmap.height, IDENTIFY_MAX_EDGE);
		canvas.width = size.width;
		canvas.height = size.height;
		const context = canvas.getContext('2d');
		if (!context) throw bad();
		// JPEG has no alpha: without a backdrop, transparent PNG pixels would turn black.
		context.fillStyle = '#fff';
		context.fillRect(0, 0, size.width, size.height);
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = 'high';
		context.drawImage(bitmap, 0, 0, size.width, size.height);
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', IDENTIFY_QUALITY)
		);
		if (!blob || blob.type !== 'image/jpeg') throw bad();
		return blob;
	} finally {
		canvas.width = 0;
		canvas.height = 0;
		bitmap.close();
	}
}

function isIdentifyResult(body: unknown): body is IdentifyResult {
	if (typeof body !== 'object' || body === null) return false;
	const value = body as Record<string, unknown>;
	if (value.ok === true) return Array.isArray(value.candidates);
	return (
		value.ok === false &&
		typeof value.code === 'string' &&
		value.code in IDENTIFY_MESSAGES &&
		typeof value.message === 'string'
	);
}

function codeForStatus(status: number): IdentifyErrorCode {
	if (status === 400) return 'bad_request';
	if (status === 401 || status === 403) return 'forbidden';
	return 'upstream';
}

/** Never throws: every outcome, including SvelteKit's bare `{ message }` error bodies, becomes an IdentifyResult. */
export async function requestIdentification(
	images: Blob[],
	fetchFn: typeof fetch = fetch
): Promise<IdentifyResult> {
	const form = new FormData();
	images.forEach((image, index) => form.append('images', image, `photo-${index + 1}.jpg`));
	let response: Response;
	try {
		response = await fetchFn('/api/identify', { method: 'POST', body: form, redirect: 'manual' });
	} catch {
		return fail('upstream');
	}
	// An expired session is redirected to /login by the hook; with redirect: 'manual' that shows up as an opaque redirect.
	if (response.type === 'opaqueredirect' || response.status === 0) return fail('forbidden');
	let body: unknown = null;
	try {
		body = await response.json();
	} catch {
		// Not JSON: fall through to the status mapping.
	}
	if (isIdentifyResult(body)) return body;
	return fail(codeForStatus(response.status));
}

/** Converts the first five sources one by one (keeps memory low on phones); sources that fail to convert are skipped. */
export async function prepareImages(
	sources: Blob[],
	convert: (blob: Blob) => Promise<Blob> = toIdentifyJpeg
): Promise<Blob[]> {
	const images: Blob[] = [];
	for (const source of sources.slice(0, IDENTIFY_MAX_IMAGES)) {
		try {
			images.push(await convert(source));
		} catch (e) {
			console.warn('Снимка пропусната при разпознаване:', e);
		}
	}
	return images;
}

/** Converts and sends; `sent` is the number of images that actually went to the API (0 means no request). */
export async function identifyBlobs(
	blobs: Blob[],
	convert: (blob: Blob) => Promise<Blob> = toIdentifyJpeg,
	request: (images: Blob[]) => Promise<IdentifyResult> = (images) => requestIdentification(images)
): Promise<{ result: IdentifyResult; sent: number }> {
	const images = await prepareImages(blobs, convert);
	if (images.length === 0) return { result: fail('bad_request'), sent: 0 };
	return { result: await request(images), sent: images.length };
}

/** Wraps an async call so that only the most recently started call is reported as current. */
export function latestOnly<A extends unknown[], R>(
	fn: (...args: A) => Promise<R>
): (...args: A) => Promise<{ stale: boolean; value: R }> {
	let latest = 0;
	return async (...args) => {
		const mine = ++latest;
		const value = await fn(...args);
		return { stale: mine !== latest, value };
	};
}
