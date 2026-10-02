import { error, fail, redirect } from '@sveltejs/kit';
import { UserFacingError } from '$lib/errors';
import { parsePlantForm, plantToFormValues } from '$lib/schemas/plant';
import { requireEditor } from '$lib/server/auth';
import { toHttpError } from '$lib/server/http';
import { deletePlant, getPlant, updatePlant } from '$lib/server/plants';
import { signPaths } from '$lib/server/signed-urls';
import { parseLegacyAi } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireEditor(locals);
	const plant = await getPlant(locals.supabase, params.id).catch(toHttpError);
	if (!plant) error(404, 'Растението не е намерено.');
	const urls = await signPaths(
		locals.supabase,
		plant.photos.map((photo) => photo.thumb_path)
	).catch(toHttpError);
	return {
		plant: { id: plant.id, name_bg: plant.name_bg },
		values: plantToFormValues(plant),
		legacy: parseLegacyAi(plant.legacy_ai),
		photos: plant.photos.map((photo) => ({
			id: photo.id,
			path: photo.path,
			thumbPath: photo.thumb_path,
			thumbUrl: urls.get(photo.thumb_path) ?? null,
			isPrimary: photo.is_primary
		}))
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		await requireEditor(locals);
		const parsed = parsePlantForm(await request.formData());
		if (!parsed.ok) return fail(400, { errors: parsed.errors, message: '' });
		try {
			await updatePlant(locals.supabase, params.id, parsed.data);
		} catch (e) {
			if (e instanceof UserFacingError) return fail(400, { errors: {}, message: e.message });
			throw e;
		}
		redirect(303, `/plants/${params.id}`);
	},
	delete: async ({ locals, params }) => {
		await requireEditor(locals);
		try {
			await deletePlant(locals.supabase, params.id);
		} catch (e) {
			if (e instanceof UserFacingError) return fail(400, { errors: {}, message: e.message });
			throw e;
		}
		redirect(303, '/');
	}
};
