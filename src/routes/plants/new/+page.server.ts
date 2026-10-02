import { fail } from '@sveltejs/kit';
import { UserFacingError } from '$lib/errors';
import { parsePlantForm, plantIdSchema } from '$lib/schemas/plant';
import { requireEditor } from '$lib/server/auth';
import { createPlant } from '$lib/server/plants';
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
		try {
			await createPlant(locals.supabase, id.data, parsed.data);
		} catch (e) {
			if (e instanceof UserFacingError) return fail(400, { values: parsed.values, errors: {}, message: e.message });
			throw e;
		}
		return { created: true, id: id.data };
	}
};
