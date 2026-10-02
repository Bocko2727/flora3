import { describe, expect, it } from 'vitest';
import { parsePlantForm, plantIdSchema, plantToFormValues } from '$lib/schemas/plant';

function formOf(values: Record<string, string>): FormData {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return form;
}

describe('parsePlantForm', () => {
	it('trims values and turns empty optional fields into null', () => {
		const result = parsePlantForm(
			formOf({ scientific_name: '  Bellis perennis ', name_bg: ' Паричка ', family: '  ', description: '', habitat: 'Ливади', notes: '' })
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.data).toEqual({
			scientific_name: 'Bellis perennis',
			name_bg: 'Паричка',
			family: null,
			description: null,
			habitat: 'Ливади',
			notes: null
		});
	});

	it('reports required fields in Bulgarian and echoes the submitted values', () => {
		const result = parsePlantForm(formOf({ scientific_name: ' ', name_bg: '' }));
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.scientific_name).toBe('Задължително поле.');
		expect(result.errors.name_bg).toBe('Задължително поле.');
		expect(result.values.scientific_name).toBe(' ');
		expect(result.values.family).toBe('');
	});

	it('enforces the length limits', () => {
		const result = parsePlantForm(
			formOf({ scientific_name: 'a'.repeat(201), name_bg: 'Б', family: 'x'.repeat(101), notes: 'n'.repeat(5001) })
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.scientific_name).toBe('Най-много 200 знака.');
		expect(result.errors.family).toBe('Най-много 100 знака.');
		expect(result.errors.notes).toBe('Най-много 5000 знака.');
	});
});

describe('plantIdSchema', () => {
	it('accepts a UUID and rejects anything else', () => {
		expect(plantIdSchema.safeParse('aaaaaaaa-0000-4000-8000-000000000001').success).toBe(true);
		expect(plantIdSchema.safeParse('not-a-uuid').success).toBe(false);
	});
});

describe('plantToFormValues', () => {
	it('maps nulls to empty strings', () => {
		expect(
			plantToFormValues({ scientific_name: 'A b', name_bg: 'Аб', family: null, description: null, habitat: 'H', notes: null })
		).toEqual({ scientific_name: 'A b', name_bg: 'Аб', family: '', description: '', habitat: 'H', notes: '' });
	});
});
