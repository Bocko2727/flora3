// Pure pixel logic for the Image Enhancer (no DOM): levels + light sharpening, colour untouched.
// Ported from docs/prototype/flora3-library.html (enhanceUrl): one luminance curve shared by R, G and B,
// so the hue never shifts; then an unsharp mask with radius 1.

export const CLIP_FRACTION = 0.004;
export const MIN_RANGE = 40;
export const CURVE_STRENGTH = 0.75;
export const SHARPEN_AMOUNT = 0.45;

/** 256-bin luminance histogram of RGBA data (same weights as the prototype). */
export function luminanceHistogram(data: Uint8ClampedArray): Uint32Array {
	const hist = new Uint32Array(256);
	for (let i = 0; i < data.length; i += 4) hist[(data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8]++;
	return hist;
}

/** Levels curve from the 0.4 % / 99.6 % luminance points, blended 75/25 with the identity. */
export function computeLut(hist: Uint32Array, pixels: number): Uint8ClampedArray {
	let lo = 0;
	let hi = 255;
	let acc = 0;
	for (; lo < 255; lo++) {
		acc += hist[lo];
		if (acc > pixels * CLIP_FRACTION) break;
	}
	acc = 0;
	for (; hi > 0; hi--) {
		acc += hist[hi];
		if (acc > pixels * CLIP_FRACTION) break;
	}
	if (hi - lo < MIN_RANGE) {
		lo = Math.max(0, lo - 20);
		hi = Math.min(255, hi + 20);
	}
	const lut = new Uint8ClampedArray(256);
	for (let v = 0; v < 256; v++) {
		const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
		lut[v] = Math.round(255 * (t * CURVE_STRENGTH + (v / 255) * (1 - CURVE_STRENGTH)));
	}
	return lut;
}

/** In place. The same table for all three channels; alpha is never touched. */
export function applyLevels(data: Uint8ClampedArray, lut: Uint8ClampedArray): void {
	for (let i = 0; i < data.length; i += 4) {
		data[i] = lut[data[i]];
		data[i + 1] = lut[data[i + 1]];
		data[i + 2] = lut[data[i + 2]];
	}
}

/** In place. Unsharp mask, radius 1 (3-tap box blur in x, then in y). Alpha is never touched. */
export function unsharp(data: Uint8ClampedArray, width: number, height: number, amount = SHARPEN_AMOUNT): void {
	const src = new Uint8ClampedArray(data);
	const tmp = new Float32Array(data.length);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const o = (y * width + x) * 4;
			const l = (y * width + Math.max(0, x - 1)) * 4;
			const r = (y * width + Math.min(width - 1, x + 1)) * 4;
			for (let k = 0; k < 3; k++) tmp[o + k] = (src[l + k] + src[o + k] + src[r + k]) / 3;
		}
	}
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const o = (y * width + x) * 4;
			const u = (Math.max(0, y - 1) * width + x) * 4;
			const d = (Math.min(height - 1, y + 1) * width + x) * 4;
			for (let k = 0; k < 3; k++) {
				const blur = (tmp[u + k] + tmp[o + k] + tmp[d + k]) / 3;
				data[o + k] = src[o + k] + amount * (src[o + k] - blur);
			}
		}
	}
}

/** The whole enhancement on RGBA pixels, in place. */
export function enhancePixels(data: Uint8ClampedArray, width: number, height: number): void {
	applyLevels(data, computeLut(luminanceHistogram(data), width * height));
	unsharp(data, width, height);
}
