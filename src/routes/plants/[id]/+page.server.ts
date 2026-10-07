import { error, fail } from '@sveltejs/kit';
import { UserFacingError } from '$lib/errors';
import { requireEditor } from '$lib/server/auth';
import { externalFetch } from '$lib/server/external/fetch';
import { toHttpError } from '$lib/server/http';
import { getPlant } from '$lib/server/plants';
import { signPaths } from '$lib/server/signed-urls';
import { isNameSource } from '$lib/status';
import { linkInat, refreshNameCheck, unlinkInat, useAcceptedName } from '$lib/server/verification';
import { parseLegacyAi } from '$lib/types';
import { photoMonths } from '$lib/catalog/months';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const plant = await getPlant(locals.supabase, params.id).catch(toHttpError);
	if (!plant) error(404, 'Растението не е намерено.');
	const urls = await signPaths(
		locals.supabase,
		plant.photos.flatMap((photo) => [photo.path, photo.thumb_path])
	).catch(toHttpError);
	const { photos, legacy_ai, latestIdentification, ...fields } = plant;
	return {
		plant: {
			id: fields.id,
			name_bg: fields.name_bg,
			scientific_name: fields.scientific_name,
			family: fields.family,
			description: fields.description,
			description_source: fields.description_source,
			wiki_url: fields.wiki_url,
			habitat: fields.habitat,
			notes: fields.notes,
			id_status: fields.id_status,
			name_source: isNameSource(fields.name_source) ? fields.name_source : ('manual' as const),
			gbif_match: fields.gbif_match,
			gbif_key: fields.gbif_key,
			gbif_accepted_key: fields.gbif_accepted_key,
			gbif_accepted_name: fields.gbif_accepted_name,
			gbif_checked_at: fields.gbif_checked_at,
			inat_observation_id: fields.inat_observation_id,
			inat_quality_grade: fields.inat_quality_grade,
			inat_taxon_name: fields.inat_taxon_name
		},
		latest: latestIdentification,
		legacy: parseLegacyAi(legacy_ai),
		months: photoMonths(photos.map((photo) => photo.taken_at)),
		datedPhotos: photos.filter((photo) => photo.taken_at).length,
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

async function run(task: () => Promise<void>) {
	try {
		await task();
	} catch (e) {
		if (e instanceof UserFacingError) return fail(400, { message: e.message });
		throw e;
	}
	return { message: '' };
}

export const actions: Actions = {
	checkName: async ({ locals, params }) => {
		await requireEditor(locals);
		return run(async () => {
			const plant = await getPlant(locals.supabase, params.id);
			if (!plant) throw new UserFacingError('Растението не е намерено или нямаш права да го променяш.');
			const ok = await refreshNameCheck(locals.supabase, params.id, plant.scientific_name, externalFetch());
			if (!ok) throw new UserFacingError('Името не можа да се провери в GBIF.');
		});
	},
	useAccepted: async ({ locals, params }) => {
		await requireEditor(locals);
		return run(() => useAcceptedName(locals.supabase, params.id, externalFetch()));
	},
	linkInat: async ({ request, locals, params }) => {
		await requireEditor(locals);
		const input = (await request.formData()).get('inat');
		return run(() => linkInat(locals.supabase, params.id, typeof input === 'string' ? input : '', externalFetch()));
	},
	unlinkInat: async ({ locals, params }) => {
		await requireEditor(locals);
		return run(() => unlinkInat(locals.supabase, params.id));
	}
};
