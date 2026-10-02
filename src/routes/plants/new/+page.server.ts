import { fail } from '@sveltejs/kit';
import { UserFacingError } from '$lib/errors';
import { deriveNameSource, parseIdentificationField } from '$lib/identify/types';
import { parsePlantForm, plantIdSchema } from '$lib/schemas/plant';
import { requireEditor } from '$lib/server/auth';
import { externalFetch } from '$lib/server/external/fetch';
import { createPlant, insertIdentification } from '$lib/server/plants';
import { refreshNameCheck } from '$lib/server/verification';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await requireEditor(locals);
	return { newId: crypto.randomUUID() };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		await requireEditor(locals);
		const form = await request.formData();
		const id = plantIdSchema.safeParse(String(form.get('id') ?? ''));
		const parsed = parsePlantForm(form);
		if (!id.success) return fail(400, { values: parsed.values, errors: {}, message: 'Невалидна заявка. Презареди страницата.' });
		if (!parsed.ok) return fail(400, { values: parsed.values, errors: parsed.errors, message: '' });
		const ident = parseIdentificationField(form.get('identification'));
		const nameSource = deriveNameSource(ident, parsed.data.scientific_name, null);
		try {
			await createPlant(locals.supabase, id.data, parsed.data, nameSource);
		} catch (e) {
			if (e instanceof UserFacingError) return fail(400, { values: parsed.values, errors: {}, message: e.message });
			throw e;
		}
		// The plant is saved; neither the AI record nor the GBIF check may turn that into a failure.
		if (ident && ident.candidates.length > 0) {
			try {
				await insertIdentification(locals.supabase, id.data, ident);
			} catch (e) {
				console.error('Identification not stored for new plant', id.data, e instanceof UserFacingError ? e.detail ?? e.message : e);
			}
		}
		try {
			await refreshNameCheck(locals.supabase, id.data, parsed.data.scientific_name, externalFetch());
		} catch (e) {
			console.error('Name check failed for new plant', id.data, e instanceof UserFacingError ? e.detail ?? e.message : e);
		}
		return { created: true, id: id.data };
	}
};
