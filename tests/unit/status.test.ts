import { describe, expect, it } from 'vitest';
import { isIdStatus, statusView, type IdStatus, type NameSource } from '$lib/status';

describe('statusView', () => {
	it('labels an AI-named draft as an AI draft', () => {
		for (const source of ['ai', 'legacy_ai'] as const) {
			expect(statusView('draft', source)).toEqual({
				tone: 'draft',
				label: 'AI чернова',
				explanation: 'Предложено от AI. Не е проверено от човек.'
			});
		}
	});

	it('labels a manually entered draft as a plain draft', () => {
		expect(statusView('draft', 'manual')).toEqual({
			tone: 'draft',
			label: 'Чернова',
			explanation: 'Въведено ръчно. Не е проверено.'
		});
	});

	it('labels an AI name accepted by GBIF regardless of the name source', () => {
		for (const source of ['manual', 'ai', 'legacy_ai'] as const) {
			expect(statusView('ai_gbif', source)).toEqual({
				tone: 'ai_gbif',
				label: 'AI · прието име',
				explanation: 'Името е валидно според GBIF. Видът е предложен от AI и не е потвърден от човек.'
			});
		}
	});

	it('labels a community-verified plant regardless of the name source', () => {
		for (const source of ['manual', 'ai', 'legacy_ai'] as const) {
			expect(statusView('community', source)).toEqual({
				tone: 'community',
				label: 'Потвърдено · iNaturalist',
				explanation: 'Наблюдение с Research Grade в iNaturalist за същия вид.'
			});
		}
	});

	it('never says "confirmed" for anything but community', () => {
		const statuses: IdStatus[] = ['draft', 'ai_gbif', 'community'];
		const sources: NameSource[] = ['manual', 'ai', 'legacy_ai'];
		for (const status of statuses) {
			for (const source of sources) {
				const { label, explanation } = statusView(status, source);
				if (status === 'community') continue;
				expect(label).not.toMatch(/отвърд/i);
				expect(explanation).not.toMatch(/Потвърдено/);
			}
		}
	});
});

describe('isIdStatus', () => {
	it('accepts only the three known statuses', () => {
		expect(isIdStatus('draft')).toBe(true);
		expect(isIdStatus('ai_gbif')).toBe(true);
		expect(isIdStatus('community')).toBe(true);
		expect(isIdStatus('confirmed')).toBe(false);
		expect(isIdStatus(null)).toBe(false);
		expect(isIdStatus(undefined)).toBe(false);
		expect(isIdStatus(1)).toBe(false);
	});
});
