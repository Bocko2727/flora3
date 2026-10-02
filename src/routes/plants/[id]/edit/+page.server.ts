import { error, fail, redirect } from '@sveltejs/kit';
import { UserFacingError } from '$lib/errors';
import { deriveNameSource, parseIdentificationField, sameName } from '$lib/identify/types';
import { parsePlantForm, plantToFormValues } from '$lib/schemas/plant';
import { requireEditor } from '$lib/server/auth';
import { toHttpError } from '$lib/server/http';
import { externalFetch } from '$lib/server/external/fetch';
import { deletePlant, getPlant, insertIdentification, updatePlant } from '$lib/server/plants';
import { signPaths } from '$lib/server/signed-urls';
import { isNameSource } from '$lib/status';
import { refreshNameCheck } from '$lib/server/verification';
import { parseLegacyAi } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	await requireEditor(locals);
	const plant = await getPlant(locals.supabase, params.id).catch(toHttpError);
	if (!plant) error(404, 'Растението не е намерено.');
	const urls = await signPaths(
		locals.supabase,
		plant.photos.flatMap((photo) => [photo.thumb_path, photo.path])
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
			url: urls.get(photo.path) ?? null,
			createdAt: photo.created_at,
			isPrimary: photo.is_primary
		}))
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		await requireEditor(locals);
		const formData = await request.formData();
		const parsed = parsePlantForm(formData);
		if (!parsed.ok) return fail(400, { errors: parsed.errors, message: '' });
		const ident = parseIdentificationField(formData.get('identification'));
		const newName = parsed.data.scientific_name;
		try {
			const previous = await getPlant(locals.supabase, params.id).catch(toHttpError);
			if (!previous) return fail(400, { errors: {}, message: 'Растението не е намерено.' });
			const renamed = !sameName(previous.scientific_name, newName);
			const nameSource = deriveNameSource(ident, newName, {
				name: previous.scientific_name,
				source: isNameSource(previous.name_source) ? previous.name_source : 'manual'
			});
			await updatePlant(locals.supabase, params.id, parsed.data, nameSource, renamed);
			// The plant is saved; neither the AI record nor the GBIF check may turn that into a failure.
			if (ident && ident.candidates.length > 0) {
				try {
					await insertIdentification(locals.supabase, params.id, ident);
				} catch (e) {
					console.error('Identification not stored', params.id, e instanceof UserFacingError ? (e.detail ?? e.message) : e);
				}
			}
			if (renamed || ident) {
				try {
					await refreshNameCheck(locals.supabase, params.id, newName, externalFetch());
				} catch (e) {
					console.error('Name check failed', params.id, e instanceof UserFacingError ? (e.detail ?? e.message) : e);
				}
			}
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
