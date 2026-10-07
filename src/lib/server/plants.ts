import { enhancedPath } from '$lib/photos/storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';
import { UserFacingError, describeDbError } from '$lib/errors';
import type { PlantFormData } from '$lib/schemas/plant';
import { isIdStatus, type IdStatus, type NameSource } from '$lib/status';
import type { Candidate, IdentificationInput } from '$lib/identify/types';
import type { PhotoRow, PlantRow } from '$lib/types';

export type Db = SupabaseClient<Database>;
export type PlantListItem = Pick<PlantRow, 'id' | 'scientific_name' | 'name_bg' | 'family' | 'name_source'> & {
	id_status: IdStatus;
	primaryThumbPath: string | null;
};
export type LatestIdentification = {
	created_at: string;
	model_version: string | null;
	candidates: Candidate[];
	chosen_index: number | null;
};
export type PlantWithPhotos = PlantRow & {
	id_status: IdStatus;
	photos: PhotoRow[];
	latestIdentification: LatestIdentification | null;
};

const NOT_FOUND_OR_FORBIDDEN = 'Растението не е намерено или нямаш права да го променяш.';

export async function listPlants(db: Db): Promise<PlantListItem[]> {
	const { data, error } = await db
		.from('plants')
		.select('id, scientific_name, name_bg, family, name_source, id_status, plant_photos(thumb_path)')
		.eq('plant_photos.is_primary', true)
		.order('name_bg', { ascending: true });
	if (error) throw new UserFacingError('Каталогът не можа да се зареди.', error);
	return data.map(({ plant_photos, id_status, ...plant }) => ({
		...plant,
		id_status: isIdStatus(id_status) ? id_status : ('draft' as const),
		primaryThumbPath: plant_photos[0]?.thumb_path ?? null
	}));
}

export async function getPlant(db: Db, id: string): Promise<PlantWithPhotos | null> {
	const { data, error } = await db
		.from('plants')
		.select('*, id_status, plant_photos(*)')
		.eq('id', id)
		.order('is_primary', { referencedTable: 'plant_photos', ascending: false })
		.order('created_at', { referencedTable: 'plant_photos', ascending: true })
		.order('id', { referencedTable: 'plant_photos', ascending: true })
		.maybeSingle();
	if (error) {
		if (error.code === '22P02') return null;
		throw new UserFacingError('Растението не можа да се зареди.', error);
	}
	if (!data) return null;
	const { plant_photos, id_status, ...plant } = data;
	const latest = await db
		.from('identifications')
		.select('created_at, model_version, candidates, chosen_index')
		.eq('plant_id', id)
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (latest.error) throw new UserFacingError('Растението не можа да се зареди.', latest.error);
	return {
		...plant,
		id_status: isIdStatus(id_status) ? id_status : 'draft',
		photos: plant_photos,
		latestIdentification: latest.data
			? {
					created_at: latest.data.created_at,
					model_version: latest.data.model_version,
					// Written only by this app through identificationSchema, so the shape is trusted.
					candidates: (Array.isArray(latest.data.candidates) ? latest.data.candidates : []) as Candidate[],
					chosen_index: latest.data.chosen_index
				}
			: null
	};
}

export async function createPlant(
	db: Db,
	id: string,
	input: PlantFormData,
	nameSource: NameSource = 'manual'
): Promise<void> {
	const { error } = await db
		.from('plants')
		.insert({ id, ...input, name_source: nameSource, description_source: input.description ? 'manual' : null });
	if (error) throw new UserFacingError(describeDbError(error, 'Растението не можа да се запише.'), error);
}

/** GBIF evidence belongs to one name; a rename must not keep it, even if the re-check later fails. */
const CLEARED_GBIF_EVIDENCE = {
	gbif_match: null,
	gbif_key: null,
	gbif_accepted_key: null,
	gbif_accepted_name: null,
	gbif_checked_at: null
};

export async function updatePlant(
	db: Db,
	id: string,
	input: PlantFormData,
	nameSource?: NameSource,
	clearGbifEvidence = false
): Promise<void> {
	// A Wikipedia text keeps its label until the owner actually changes it.
	const { data: current } = await db.from('plants').select('description').eq('id', id).maybeSingle();
	const descriptionChanged = (current?.description ?? null) !== (input.description ?? null);
	const { data, error } = await db
		.from('plants')
		.update({
			...input,
			...(descriptionChanged ? { description_source: input.description ? 'manual' : null, wiki_url: null } : {}),
			...(nameSource ? { name_source: nameSource } : {}),
			...(clearGbifEvidence ? CLEARED_GBIF_EVIDENCE : {})
		})
		.eq('id', id)
		.select('id');
	if (error) throw new UserFacingError(describeDbError(error, 'Промените не можаха да се запишат.'), error);
	if (data.length === 0) throw new UserFacingError(NOT_FOUND_OR_FORBIDDEN);
}

export async function insertIdentification(db: Db, plantId: string, ident: IdentificationInput): Promise<void> {
	const { error } = await db.from('identifications').insert({
		plant_id: plantId,
		model_version: ident.modelVersion,
		photo_count: ident.photoCount,
		candidates: ident.candidates,
		chosen_index: ident.chosenIndex
	});
	if (error) throw new UserFacingError(describeDbError(error, 'Разпознаването не можа да се запише.'), error);
}

export async function deletePlant(db: Db, id: string): Promise<void> {
	const { data, error } = await db.rpc('delete_plant', { target_plant: id });
	if (error) {
		const message =
			error.code === 'P0002'
				? NOT_FOUND_OR_FORBIDDEN
				: describeDbError(error, 'Растението не можа да се изтрие.');
		throw new UserFacingError(message, error);
	}

	const paths = data.flatMap((row) => [row.path, row.thumb_path, enhancedPath(row.path)]);
	if (paths.length > 0) {
		const { error: removeError } = await db.storage.from('photos').remove(paths);
		if (removeError) console.error('Orphaned photo files after deleting plant', id, paths, removeError);
	}
}
