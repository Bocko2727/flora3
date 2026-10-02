import { describe, expect, it } from 'vitest';
import { applyOverrides, parseOverrides } from '../../scripts/import/overrides';

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'aaaaaaaa-0000-4000-8000-000000000002';
const url1 = 'https://old.supabase.co/storage/v1/object/public/plant-images/1.png';
const url2 = 'https://old.supabase.co/storage/v1/object/public/plant-images/2.png';
const records = () => [
	{ id: A, latin_name: 'Sedum album', photos: [url1] },
	{ id: B, latin_name: 'Pulmonaria officinalis', photos: [url1, ` ${url2} `] }
];

describe('parseOverrides', () => {
	it('accepts a valid file and defaults missing lists to empty', () => {
		expect(parseOverrides({ excludePlants: [{ id: A, reason: 'x' }] })).toEqual({
			excludePlants: [{ id: A, reason: 'x' }],
			dropPhotos: []
		});
	});

	it('rejects entries without a reason', () => {
		expect(() => parseOverrides({ excludePlants: [{ id: A }] })).toThrow();
		expect(() => parseOverrides({ dropPhotos: [{ plantId: A, url: url1 }] })).toThrow();
	});

	it('rejects unknown keys so typos do not pass silently', () => {
		expect(() => parseOverrides({ excludePlant: [] })).toThrow();
	});
});

describe('applyOverrides', () => {
	it('removes excluded plants and dropped photos, without mutating the input', () => {
		const input = records();
		const result = applyOverrides(input, {
			excludePlants: [{ id: A, reason: 'wrong photo' }],
			dropPhotos: [{ plantId: B, url: url2, reason: 'duplicate' }]
		});
		expect(result.records).toEqual([{ id: B, latin_name: 'Pulmonaria officinalis', photos: [url1] }]);
		expect(result.applied).toEqual([
			`exclude plant ${A} (Sedum album): wrong photo`,
			`drop photo ${url2} from plant ${B} (Pulmonaria officinalis): duplicate`
		]);
		expect(input).toEqual(records());
	});

	it('fails when an excluded plant is not in the export', () => {
		expect(() =>
			applyOverrides(records(), { excludePlants: [{ id: 'aaaaaaaa-0000-4000-8000-000000000009', reason: 'x' }], dropPhotos: [] })
		).toThrow(/not in the export/);
	});

	it('fails when a dropped photo is not on that plant', () => {
		expect(() =>
			applyOverrides(records(), { excludePlants: [], dropPhotos: [{ plantId: A, url: url2, reason: 'x' }] })
		).toThrow(/not on plant/);
	});

	it('fails when a dropped photo belongs to an excluded plant (contradictory overrides)', () => {
		expect(() =>
			applyOverrides(records(), {
				excludePlants: [{ id: A, reason: 'x' }],
				dropPhotos: [{ plantId: A, url: url1, reason: 'y' }]
			})
		).toThrow(/excluded/);
	});
});
