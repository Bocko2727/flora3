import { describe, expect, it } from 'vitest';
import { applyLevels, computeLut, enhancePixels, luminanceHistogram, unsharp } from '$lib/photos/enhance';

const rgba = (pixels: number[][]) => new Uint8ClampedArray(pixels.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));

describe('luminanceHistogram', () => {
	it('counts every pixel exactly once', () => {
		const hist = luminanceHistogram(rgba([[0, 0, 0], [255, 255, 255], [120, 130, 140]]));
		expect(hist).toHaveLength(256);
		expect(hist.reduce((a, b) => a + b, 0)).toBe(3);
		expect(hist[0]).toBe(1);
		expect(hist[255]).toBe(1);
	});
});

describe('computeLut', () => {
	it('stretches a low-contrast picture: darks get darker, lights get lighter', () => {
		const pixels = Array.from({ length: 200 }, (_, i) => {
			const v = 100 + (i % 41);
			return [v, v, v];
		});
		const data = rgba(pixels);
		const lut = computeLut(luminanceHistogram(data), pixels.length);
		expect(lut[100]).toBeLessThan(100);
		expect(lut[140]).toBeGreaterThan(140);
	});

	it('never reverses the order of tones', () => {
		const data = rgba(Array.from({ length: 256 }, (_, v) => [v, v, v]));
		const lut = computeLut(luminanceHistogram(data), 256);
		for (let v = 1; v < 256; v++) expect(lut[v]).toBeGreaterThanOrEqual(lut[v - 1]);
	});

	it('widens a nearly flat range instead of exploding it', () => {
		const data = rgba(Array.from({ length: 100 }, () => [128, 128, 128]));
		const lut = computeLut(luminanceHistogram(data), 100);
		expect(Math.abs(lut[128] - 128)).toBeLessThan(10);
	});
});

describe('applyLevels', () => {
	it('uses one curve for R, G and B, so grey stays grey and colour order stays', () => {
		const lut = new Uint8ClampedArray(256).map((_, v) => Math.min(255, Math.round(v * 1.2)));
		const data = rgba([[100, 100, 100], [200, 120, 40]]);
		applyLevels(data, lut);
		expect(data[0]).toBe(data[1]);
		expect(data[1]).toBe(data[2]);
		expect(data[4]).toBeGreaterThanOrEqual(data[5]);
		expect(data[5]).toBeGreaterThanOrEqual(data[6]);
	});

	it('leaves alpha alone', () => {
		const lut = new Uint8ClampedArray(256).fill(7);
		const data = rgba([[10, 20, 30, 77]]);
		applyLevels(data, lut);
		expect(data[3]).toBe(77);
	});
});

describe('unsharp', () => {
	it('leaves a flat picture unchanged', () => {
		const data = rgba(Array.from({ length: 9 }, () => [90, 140, 60]));
		const before = Array.from(data);
		unsharp(data, 3, 3, 0.45);
		expect(Array.from(data)).toEqual(before);
	});

	it('sharpens a step edge (overshoot on both sides) and keeps alpha', () => {
		const row = [[50, 50, 50], [50, 50, 50], [200, 200, 200], [200, 200, 200]];
		const data = rgba(row.map((p) => [...p, 255]));
		unsharp(data, 4, 1, 0.45);
		expect(data[4]).toBeLessThan(50); // dark side next to the edge goes darker
		expect(data[8]).toBeGreaterThan(200); // light side goes lighter
		expect(data[3]).toBe(255);
	});
});

describe('enhancePixels', () => {
	it('handles a single pixel without throwing', () => {
		const data = rgba([[10, 200, 30]]);
		expect(() => enhancePixels(data, 1, 1)).not.toThrow();
		expect(data[3]).toBe(255);
	});

	it('keeps the hue order of a green leaf pixel (G stays the strongest channel)', () => {
		const pixels = Array.from({ length: 64 }, (_, i) => [40 + (i % 8), 90 + (i % 16), 30 + (i % 4)]);
		const data = rgba(pixels);
		enhancePixels(data, 8, 8);
		for (let i = 0; i < 64; i++) expect(data[i * 4 + 1]).toBeGreaterThanOrEqual(data[i * 4]);
	});
});
