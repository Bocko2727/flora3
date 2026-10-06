import { describe, expect, it } from 'vitest';
import { photoMonths } from '$lib/catalog/months';
import { LEGACY_AI_FIELDS, LEGACY_AI_QUESTIONS } from '$lib/types';

describe('photoMonths', () => {
	it('returns the distinct months (1–12) the photos were taken in, sorted', () => {
		expect(photoMonths(['2026-09-05T09:04:43Z', '2025-07-16T09:33:01Z', '2026-09-06T12:00:00Z'])).toEqual([7, 9]);
	});
	it('skips photos without a date or with an invalid one', () => {
		expect(photoMonths([null, undefined, 'not-a-date', '2026-03-07T11:59:04Z'])).toEqual([3]);
	});
	it('uses the calendar month in UTC, so a late-night photo keeps its stored month', () => {
		expect(photoMonths(['2026-08-31T23:30:00Z'])).toEqual([8]);
	});
});

describe('LEGACY_AI_QUESTIONS', () => {
	it('asks one question for every old AI field', () => {
		for (const field of LEGACY_AI_FIELDS) expect(LEGACY_AI_QUESTIONS[field]).toMatch(/\S/);
		expect(LEGACY_AI_QUESTIONS.recognition).toBe('Как да го разпозная?');
		expect(LEGACY_AI_QUESTIONS.lookalikes).toBe('С какво може да се сбърка?');
	});
});
