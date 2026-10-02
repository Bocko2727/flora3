import type { Database } from '$lib/database.types';
import { UserFacingError, describeDbError } from '$lib/errors';
import { checkNameWithGbif } from '$lib/server/external/gbif';
import { fetchInatObservation, parseInatObservationId } from '$lib/server/external/inat';
import type { Db } from '$lib/server/plants';

const NOT_FOUND_OR_FORBIDDEN = 'Растението не е намерено или нямаш права да го променяш.';

type PlantUpdate = Database['public']['Tables']['plants']['Update'];

async function updateOwned(db: Db, plantId: string, values: PlantUpdate, fallback: string): Promise<void> {
	const { data, error } = await db.from('plants').update(values).eq('id', plantId).select('id');
	if (error) throw new UserFacingError(describeDbError(error, fallback), error);
	if (data.length === 0) throw new UserFacingError(NOT_FOUND_OR_FORBIDDEN);
}

/** Returns false (and writes nothing) when GBIF is unreachable; the plant keeps its previous evidence. */
export async function refreshNameCheck(
	db: Db,
	plantId: string,
	scientificName: string,
	fetchFn: typeof fetch = fetch
): Promise<boolean> {
	let check;
	try {
		check = await checkNameWithGbif(scientificName, fetchFn);
	} catch (e) {
		if (!(e instanceof UserFacingError)) throw e;
		console.error('GBIF name check failed', plantId, e.detail ?? e.message);
		return false;
	}
	await updateOwned(
		db,
		plantId,
		{
			gbif_match: check.match,
			gbif_key: check.key,
			gbif_accepted_key: check.acceptedKey,
			gbif_accepted_name: check.acceptedName,
			gbif_checked_at: new Date().toISOString()
		},
		'Резултатът от GBIF не можа да се запише.'
	);
	return true;
}

export async function useAcceptedName(db: Db, plantId: string, fetchFn: typeof fetch = fetch): Promise<void> {
	const { data, error } = await db.from('plants').select('gbif_accepted_name').eq('id', plantId).maybeSingle();
	if (error) throw new UserFacingError('Растението не можа да се зареди.', error);
	if (!data) throw new UserFacingError(NOT_FOUND_OR_FORBIDDEN);
	if (!data.gbif_accepted_name) throw new UserFacingError('Няма прието име за смяна.');
	// The old GBIF evidence described the old name; clear it so a failed re-check cannot leave it behind.
	await updateOwned(
		db,
		plantId,
		{
			scientific_name: data.gbif_accepted_name,
			name_source: 'manual',
			gbif_match: null,
			gbif_key: null,
			gbif_accepted_key: null,
			gbif_accepted_name: null,
			gbif_checked_at: null
		},
		'Името не можа да се смени.'
	);
	await refreshNameCheck(db, plantId, data.gbif_accepted_name, fetchFn);
}

export async function linkInat(db: Db, plantId: string, input: string, fetchFn: typeof fetch = fetch): Promise<void> {
	const id = parseInatObservationId(input);
	if (id === null) throw new UserFacingError('Това не е линк към наблюдение в iNaturalist.');
	const observation = await fetchInatObservation(id, fetchFn);
	if (!observation) throw new UserFacingError('Наблюдението не е намерено.');
	await updateOwned(
		db,
		plantId,
		{
			inat_observation_id: id,
			inat_quality_grade: observation.qualityGrade,
			inat_taxon_name: observation.taxonName,
			inat_checked_at: new Date().toISOString()
		},
		'Връзката с iNaturalist не можа да се запише.'
	);
}

export async function unlinkInat(db: Db, plantId: string): Promise<void> {
	await updateOwned(
		db,
		plantId,
		{ inat_observation_id: null, inat_quality_grade: null, inat_taxon_name: null, inat_checked_at: null },
		'Връзката не можа да се премахне.'
	);
}
