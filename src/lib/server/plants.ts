import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';
import { UserFacingError, describeDbError } from '$lib/errors';
import type { PlantFormData } from '$lib/schemas/plant';
import type { PhotoRow, PlantRow, PlantStatus } from '$lib/types';

export type Db = SupabaseClient<Database>;
export type PlantListItem = Pick<PlantRow, 'id' | 'scientific_name' | 'name_bg' | 'status'> & {
	primaryThumbPath: string | null;
};
export type PlantWithPhotos = PlantRow & { photos: PhotoRow[] };

const NOT_FOUND_OR_FORBIDDEN = 'Растението не е намерено или нямаш права да го променяш.';

export async function listPlants(db: Db): Promise<PlantListItem[]> {
	const { data, error } = await db
		.from('plants')
		.select('id, scientific_name, name_bg, status, plant_photos(thumb_path)')
		.eq('plant_photos.is_primary', true)
		.order('name_bg', { ascending: true });
	if (error) throw new UserFacingError('Каталогът не можа да се зареди.', error);
	return data.map(({ plant_photos, ...plant }) => ({
		...plant,
		primaryThumbPath: plant_photos[0]?.thumb_path ?? null
	}));
}

export async function getPlant(db: Db, id: string): Promise<PlantWithPhotos | null> {
	const { data, error } = await db
		.from('plants')
		.select('*, plant_photos(*)')
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
	const { plant_photos, ...plant } = data;
	return { ...plant, photos: plant_photos };
}

export async function createPlant(db: Db, id: string, input: PlantFormData): Promise<void> {
	const { error } = await db.from('plants').insert({ id, ...input });
	if (error) throw new UserFacingError(describeDbError(error, 'Растението не можа да се запише.'), error);
}

export async function updatePlant(db: Db, id: string, input: PlantFormData): Promise<void> {
	const { data, error } = await db.from('plants').update(input).eq('id', id).select('id');
	if (error) throw new UserFacingError(describeDbError(error, 'Промените не можаха да се запишат.'), error);
	if (data.length === 0) throw new UserFacingError(NOT_FOUND_OR_FORBIDDEN);
}

export async function setPlantStatus(db: Db, id: string, status: PlantStatus): Promise<void> {
	const confirmed_at = status === 'confirmed' ? new Date().toISOString() : null;
	const { data, error } = await db.from('plants').update({ status, confirmed_at }).eq('id', id).select('id');
	if (error) throw new UserFacingError(describeDbError(error, 'Статусът не можа да се смени.'), error);
	if (data.length === 0) throw new UserFacingError(NOT_FOUND_OR_FORBIDDEN);
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

	const paths = data.flatMap((row) => [row.path, row.thumb_path]);
	if (paths.length > 0) {
		const { error: removeError } = await db.storage.from('photos').remove(paths);
		if (removeError) console.error('Orphaned photo files after deleting plant', id, paths, removeError);
	}
}
