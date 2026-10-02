import { z } from 'zod';
import type { PlantRow } from '$lib/types';

const FIELDS = ['scientific_name', 'name_bg', 'family', 'description', 'habitat', 'notes'] as const;

const requiredText = (max: number) =>
	z.string().trim().min(1, 'Задължително поле.').max(max, `Най-много ${max} знака.`);
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max, `Най-много ${max} знака.`)
		.transform((value) => (value === '' ? null : value));

export const plantFormSchema = z.object({
	scientific_name: requiredText(200),
	name_bg: requiredText(200),
	family: optionalText(100),
	description: optionalText(5000),
	habitat: optionalText(5000),
	notes: optionalText(5000)
});

export const plantIdSchema = z.uuid();

export type PlantFormData = z.output<typeof plantFormSchema>;
export type PlantFormValues = Record<(typeof FIELDS)[number], string>;
export type PlantFormErrors = Partial<Record<keyof PlantFormValues, string>>;

export function parsePlantForm(
	form: FormData
):
	| { ok: true; data: PlantFormData; values: PlantFormValues }
	| { ok: false; errors: PlantFormErrors; values: PlantFormValues } {
	const values = Object.fromEntries(
		FIELDS.map((field) => [field, String(form.get(field) ?? '')])
	) as PlantFormValues;
	const result = plantFormSchema.safeParse(values);
	if (result.success) return { ok: true, data: result.data, values };
	const errors: PlantFormErrors = {};
	for (const issue of result.error.issues) {
		const field = issue.path[0] as keyof PlantFormValues;
		errors[field] ??= issue.message;
	}
	return { ok: false, errors, values };
}

export function plantToFormValues(plant: Pick<PlantRow, keyof PlantFormValues>): PlantFormValues {
	return Object.fromEntries(FIELDS.map((field) => [field, plant[field] ?? ''])) as PlantFormValues;
}
