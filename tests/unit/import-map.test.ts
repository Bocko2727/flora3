import { describe, expect, it } from 'vitest';
import { mapLegacyPlant } from '../../scripts/import/map';

const owner = '11111111-1111-4111-8111-111111111111';
const at = '2026-10-01T12:00:00.000Z';
const raw = {
	id: 'aaaaaaaa-0000-4000-8000-000000000001',
	common_name: ' Лайка ',
	latin_name: ' Matricaria chamomilla ',
	family: '',
	photos: [
		'https://old.supabase.co/storage/v1/object/public/plant-images/IMG_1.jpg',
		' https://old.supabase.co/storage/v1/object/public/plant-images/IMG_1.jpg ',
		'',
		'https://old.supabase.co/storage/v1/object/public/plant-images/IMG_2.jpg'
	],
	confidence: 'Потвърдено (AI 90%)',
	recognition: 'Бели венчелистчета',
	habitat: '  ',
	lookalikes: null,
	benefits: 'Чай',
	risks: 'Алергии',
	uses: 'Отвара',
	fun_fact: 'Ухае на ябълка',
	source_file: 'IMG_1.json'
};

describe('mapLegacyPlant', () => {
	it('maps names, keeps the old id, and marks the plant unverified', () => {
		const { plant } = mapLegacyPlant(raw, owner, at);
		expect(plant).toMatchObject({
			id: raw.id,
			owner_id: owner,
			name_bg: 'Лайка',
			scientific_name: 'Matricaria chamomilla',
			family: null,
			status: 'unverified',
			confirmed_at: null,
			description: null,
			habitat: null,
			notes: null
		});
	});

	it('moves every AI text, the old confidence and provenance into legacy_ai only', () => {
		const { plant } = mapLegacyPlant(raw, owner, at);
		expect(plant.legacy_ai).toEqual({
			recognition: 'Бели венчелистчета',
			benefits: 'Чай',
			risks: 'Алергии',
			uses: 'Отвара',
			fun_fact: 'Ухае на ябълка',
			confidence: 'Потвърдено (AI 90%)',
			source_file: 'IMG_1.json',
			legacy_id: raw.id,
			imported_at: at
		});
	});

	it('trims, de-duplicates and drops empty photo URLs, preserving order', () => {
		expect(mapLegacyPlant(raw, owner, at).photoUrls).toEqual([
			'https://old.supabase.co/storage/v1/object/public/plant-images/IMG_1.jpg',
			'https://old.supabase.co/storage/v1/object/public/plant-images/IMG_2.jpg'
		]);
	});

	it('rejects records without required names or with a bad id', () => {
		expect(() => mapLegacyPlant({ ...raw, latin_name: undefined }, owner, at)).toThrow();
		expect(() => mapLegacyPlant({ ...raw, id: 'nope' }, owner, at)).toThrow();
		expect(() => mapLegacyPlant({ ...raw, common_name: '   ' }, owner, at)).toThrow();
	});
});
