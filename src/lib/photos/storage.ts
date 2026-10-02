import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/database.types';
import { UserFacingError, describeDbError } from '$lib/errors';
import type { PhotoMime, ProcessedPhoto } from '$lib/photos/process';
import type { PhotoRow } from '$lib/types';

type Db = SupabaseClient<Database>;

const BUCKET = 'photos';
export const DUPLICATE_PHOTO_MESSAGE = 'Тази снимка вече е качена.';
const DUPLICATE = DUPLICATE_PHOTO_MESSAGE;

export function photoPaths(ownerId: string, plantId: string, photoId: string, mime: PhotoMime) {
	const ext = mime === 'image/webp' ? 'webp' : 'jpg';
	const base = `${ownerId}/${plantId}/${photoId}`;
	return { path: `${base}.${ext}`, thumbPath: `${base}_thumb.${ext}` };
}

export async function findPhotoBySha(db: Db, sha256: string): Promise<{ id: string; plant_id: string } | null> {
	const { data, error } = await db.from('plant_photos').select('id, plant_id').eq('sha256', sha256).maybeSingle();
	if (error) throw new UserFacingError('Снимката не можа да се провери.', error);
	return data;
}

async function rowReferences(db: Db, path: string): Promise<boolean> {
	const { data } = await db.from('plant_photos').select('id').eq('path', path).maybeSingle();
	return data !== null;
}

export async function savePhoto(
	db: Db,
	input: { ownerId: string; plantId: string; photoId: string; photo: ProcessedPhoto }
): Promise<PhotoRow> {
	const { ownerId, plantId, photoId, photo } = input;
	if (await findPhotoBySha(db, photo.sha256)) throw new UserFacingError(DUPLICATE);

	const { path, thumbPath } = photoPaths(ownerId, plantId, photoId, photo.mime);
	if (await rowReferences(db, path)) throw new UserFacingError(DUPLICATE);

	const bucket = db.storage.from(BUCKET);
	const options = { contentType: photo.mime, upsert: true, cacheControl: '31536000' };

	const fullUpload = await bucket.upload(path, photo.full, options);
	if (fullUpload.error) throw new UserFacingError('Снимката не можа да се качи.', fullUpload.error);

	const thumbUpload = await bucket.upload(thumbPath, photo.thumb, options);
	if (thumbUpload.error) {
		await bucket.remove([path]);
		throw new UserFacingError('Снимката не можа да се качи.', thumbUpload.error);
	}

	const { data, error } = await db
		.from('plant_photos')
		.insert({
			id: photoId,
			plant_id: plantId,
			path,
			thumb_path: thumbPath,
			mime: photo.mime,
			width: photo.width,
			height: photo.height,
			bytes: photo.full.size,
			sha256: photo.sha256,
			taken_at: photo.takenAt
		})
		.select()
		.single();

	if (error) {
		if (!(await rowReferences(db, path))) await bucket.remove([path, thumbPath]);
		if (error.code === '23505') throw new UserFacingError(DUPLICATE, error);
		throw new UserFacingError(describeDbError(error, 'Снимката не можа да се запише.'), error);
	}
	return data;
}

export async function deletePhoto(db: Db, photo: { id: string; path: string; thumb_path: string }): Promise<void> {
	const { data, error } = await db.from('plant_photos').delete().eq('id', photo.id).select('id');
	if (error) throw new UserFacingError(describeDbError(error, 'Снимката не можа да се изтрие.'), error);
	if (data.length === 0) throw new UserFacingError('Снимката не е намерена или нямаш права да я изтриеш.');
	const { error: removeError } = await db.storage.from(BUCKET).remove([photo.path, photo.thumb_path]);
	if (removeError) console.error('Orphaned photo files after deleting', photo.id, removeError);
}

export async function setPrimaryPhoto(db: Db, photoId: string): Promise<void> {
	const { error } = await db.rpc('set_primary_photo', { photo_id: photoId });
	if (error) throw new UserFacingError(describeDbError(error, 'Основната снимка не можа да се смени.'), error);
}
