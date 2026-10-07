import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';
import { UserFacingError } from '$lib/errors';
import type { ProcessedPhoto } from '$lib/photos/process';
import { deletePhoto, findPhotoBySha, removeEnhanced, saveEnhanced, savePhoto, setPrimaryPhoto } from '$lib/photos/storage';
import { findEnhanced } from '$lib/server/enhanced';
import { createPlant } from '$lib/server/plants';
import { signPaths } from '$lib/server/signed-urls';
import { EDITOR, VIEWER, ensureUser, resetCatalog, signedInClient } from '../helpers/supabase';

let editor: SupabaseClient<Database>;
let viewer: SupabaseClient<Database>;
let editorId: string;
let plantId: string;

async function photo(color: string, sha: string): Promise<ProcessedPhoto> {
	const make = (size: number) =>
		sharp({ create: { width: size, height: size, channels: 3, background: color } }).webp().toBuffer();
	const [full, thumb] = await Promise.all([make(64), make(16)]);
	return {
		full: new Blob([new Uint8Array(full)], { type: 'image/webp' }),
		thumb: new Blob([new Uint8Array(thumb)], { type: 'image/webp' }),
		mime: 'image/webp',
		width: 64,
		height: 64,
		sha256: sha.repeat(64).slice(0, 64),
		takenAt: null
	};
}

async function objectCount(prefix: string): Promise<number> {
	const { data, error } = await editor.storage.from('photos').list(prefix);
	if (error) throw error;
	return data.length;
}

beforeAll(async () => {
	editorId = await ensureUser(EDITOR, { editor: true });
	await ensureUser(VIEWER, { editor: false });
	editor = await signedInClient(EDITOR);
	viewer = await signedInClient(VIEWER);
});

beforeEach(async () => {
	await resetCatalog();
	plantId = randomUUID();
	await createPlant(editor, plantId, {
		scientific_name: 'Bellis perennis', name_bg: 'Паричка', family: null, description: null, habitat: null, notes: null
	});
});

describe('photo storage', () => {
	it('saves both files and a row, and the files are readable through signed URLs', async () => {
		const photoId = randomUUID();
		const row = await savePhoto(editor, { ownerId: editorId, plantId, photoId, photo: await photo('#2f6b3a', 'a') });
		expect(row).toMatchObject({ id: photoId, plant_id: plantId, is_primary: true, mime: 'image/webp', width: 64, height: 64 });

		const urls = await signPaths(viewer, [row.path, row.thumb_path, row.path]);
		expect(urls.size).toBe(2);
		const response = await fetch(urls.get(row.path)!);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('image/webp');
		expect(await findPhotoBySha(editor, row.sha256)).toEqual({ id: photoId, plant_id: plantId });
	});

	it('re-saving the same photo is rejected and keeps the original files', async () => {
		const photoId = randomUUID();
		const input = { ownerId: editorId, plantId, photoId, photo: await photo('#c9a227', 'b') };
		const row = await savePhoto(editor, input);

		await expect(savePhoto(editor, input)).rejects.toThrow(new UserFacingError('Тази снимка вече е качена.'));
		await expect(savePhoto(editor, { ...input, photoId: randomUUID() })).rejects.toThrow(
			new UserFacingError('Тази снимка вече е качена.')
		);

		expect(await objectCount(`${editorId}/${plantId}`)).toBe(2);
		const urls = await signPaths(editor, [row.path]);
		expect((await fetch(urls.get(row.path)!)).status).toBe(200);
	});

	it('three sequential photos leave exactly one primary, and set/delete move it', async () => {
		const rows = [];
		for (const [color, sha] of [['#111111', 'c'], ['#222222', 'd'], ['#333333', 'e']] as const) {
			rows.push(await savePhoto(editor, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo(color, sha) }));
		}
		const primaries = async () => {
			const { data } = await editor.from('plant_photos').select('id').eq('plant_id', plantId).eq('is_primary', true);
			return (data ?? []).map((r) => r.id);
		};
		expect(await primaries()).toEqual([rows[0].id]);

		await setPrimaryPhoto(editor, rows[2].id);
		expect(await primaries()).toEqual([rows[2].id]);

		await deletePhoto(editor, rows[2]);
		expect((await primaries()).length).toBe(1);
		expect(await objectCount(`${editorId}/${plantId}`)).toBe(4);
	});

	it('refuses viewer writes and leaves everything in place', async () => {
		const row = await savePhoto(editor, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo('#444444', 'f') });

		await expect(deletePhoto(viewer, row)).rejects.toBeInstanceOf(UserFacingError);
		await expect(setPrimaryPhoto(viewer, row.id)).rejects.toBeInstanceOf(UserFacingError);
		await expect(
			savePhoto(viewer, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo('#555555', '1') })
		).rejects.toBeInstanceOf(UserFacingError);

		const { data } = await editor.from('plant_photos').select('id').eq('plant_id', plantId);
		expect(data?.length).toBe(1);
		expect(await objectCount(`${editorId}/${plantId}`)).toBe(2);
	});

	it('signPaths returns only the paths that exist', async () => {
		const row = await savePhoto(editor, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo('#666666', '2') });
		const missing = `${editorId}/${plantId}/${randomUUID()}.webp`;
		const urls = await signPaths(editor, [row.path, missing]);
		expect([...urls.keys()]).toEqual([row.path]);
	});

	it('deletePhoto removes the files of the row it deleted, not the paths passed in', async () => {
		const first = await savePhoto(editor, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo('#777777', '3') });
		const second = await savePhoto(editor, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo('#888888', '4') });

		await deletePhoto(editor, { id: second.id, path: first.path, thumb_path: first.thumb_path });

		const { data } = await editor.from('plant_photos').select('id').eq('plant_id', plantId);
		expect(data?.map((r) => r.id)).toEqual([first.id]);
		expect(await objectCount(`${editorId}/${plantId}`)).toBe(2);
		const urls = await signPaths(editor, [first.path, second.path]);
		expect([...urls.keys()]).toEqual([first.path]);
		expect((await fetch(urls.get(first.path)!)).status).toBe(200);
	});
});

describe('enhanced copy', () => {
	const enhancedBlob = async () =>
		new Blob([new Uint8Array(await sharp({ create: { width: 32, height: 32, channels: 3, background: '#88aa66' } }).jpeg().toBuffer())], {
			type: 'image/jpeg'
		});
	const bytesOf = async (path: string) => {
		const urls = await signPaths(editor, [path]);
		return Buffer.from(await (await fetch(urls.get(path)!)).arrayBuffer());
	};

	it('is a separate file: the original and its thumbnail stay byte for byte the same', async () => {
		const row = await savePhoto(editor, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo('#2f6b3a', '8') });
		const before = await bytesOf(row.path);
		const thumbBefore = await bytesOf(row.thumb_path);

		await saveEnhanced(editor, row.path, await enhancedBlob());

		expect(await objectCount(`${editorId}/${plantId}`)).toBe(3);
		expect((await bytesOf(row.path)).equals(before)).toBe(true);
		expect((await bytesOf(row.thumb_path)).equals(thumbBefore)).toBe(true);
		expect([...(await findEnhanced(editor, [row.path]))]).toEqual([row.path]);
		const { data } = await editor.from('plant_photos').select('sha256, path').eq('id', row.id).single();
		expect(data).toEqual({ sha256: row.sha256, path: row.path });
	});

	it('can be removed on its own without touching the original', async () => {
		const row = await savePhoto(editor, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo('#2f6b3a', '9') });
		await saveEnhanced(editor, row.path, await enhancedBlob());
		await removeEnhanced(editor, [row.path]);
		expect(await objectCount(`${editorId}/${plantId}`)).toBe(2);
		expect((await findEnhanced(editor, [row.path])).size).toBe(0);
	});

	it('is deleted together with its photo', async () => {
		const row = await savePhoto(editor, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo('#2f6b3a', '7') });
		await saveEnhanced(editor, row.path, await enhancedBlob());
		await deletePhoto(editor, row);
		expect(await objectCount(`${editorId}/${plantId}`)).toBe(0);
	});

	it('is not writable or removable by a viewer', async () => {
		const row = await savePhoto(editor, { ownerId: editorId, plantId, photoId: randomUUID(), photo: await photo('#2f6b3a', '6') });
		await expect(saveEnhanced(viewer, row.path, await enhancedBlob())).rejects.toBeInstanceOf(UserFacingError);
		await saveEnhanced(editor, row.path, await enhancedBlob());
		await removeEnhanced(viewer, [row.path]).catch(() => {});
		expect((await findEnhanced(viewer, [row.path])).size).toBe(1);
	});
});
