import { error } from '@sveltejs/kit';
import { toHttpError } from '$lib/server/http';
import { getPlant } from '$lib/server/plants';
import { signPaths } from '$lib/server/signed-urls';
import { isNameSource } from '$lib/status';
import { parseLegacyAi } from '$lib/types';
import type { PageServerLoad } from './$types';

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
			id_status: fields.id_status,
			name_source: isNameSource(fields.name_source) ? fields.name_source : ('manual' as const)
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
