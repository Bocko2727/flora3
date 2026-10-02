import { error, fail } from '@sveltejs/kit';
import { UserFacingError } from '$lib/errors';
import { requireEditor } from '$lib/server/auth';
import { toHttpError } from '$lib/server/http';
import { getPlant, setPlantStatus } from '$lib/server/plants';
import { signPaths } from '$lib/server/signed-urls';
import { parseLegacyAi, type PlantStatus } from '$lib/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const plant = await getPlant(locals.supabase, params.id).catch(toHttpError);
	if (!plant) error(404, 'Растението не е намерено.');
	const urls = await signPaths(
		locals.supabase,
		plant.photos.flatMap((photo) => [photo.path, photo.thumb_path])
	).catch(toHttpError);
	const { photos, legacy_ai, ...fields } = plant;
	return {
		plant: {
			id: fields.id,
			name_bg: fields.name_bg,
			scientific_name: fields.scientific_name,
			family: fields.family,
			description: fields.description,
			habitat: fields.habitat,
			notes: fields.notes,
			status: fields.status,
			confirmed_at: fields.confirmed_at
		},
		legacy: parseLegacyAi(legacy_ai),
		photos: photos.map((photo) => ({
			id: photo.id,
			url: urls.get(photo.path) ?? null,
			thumbUrl: urls.get(photo.thumb_path) ?? null,
			width: photo.width,
			height: photo.height,
			isPrimary: photo.is_primary
		}))
	};
};

async function changeStatus(locals: App.Locals, id: string, status: PlantStatus) {
	await requireEditor(locals);
	try {
		await setPlantStatus(locals.supabase, id, status);
	} catch (e) {
		if (e instanceof UserFacingError) {
			console.error(e.message, e.detail);
			return fail(400, { message: e.message });
		}
		throw e;
	}
}

export const actions: Actions = {
	confirm: ({ locals, params }) => changeStatus(locals, params.id, 'confirmed'),
	unconfirm: ({ locals, params }) => changeStatus(locals, params.id, 'unverified')
};
