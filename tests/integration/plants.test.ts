import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';
import { UserFacingError } from '$lib/errors';
import { createPlant, deletePlant, getPlant, listPlants, updatePlant } from '$lib/server/plants';
import { EDITOR, VIEWER, adminClient, ensureUser, resetCatalog, signedInClient } from '../helpers/supabase';

const base = { scientific_name: 'Bellis perennis', name_bg: 'Паричка', family: 'Asteraceae', description: null, habitat: null, notes: null };

let editor: SupabaseClient<Database>;
let viewer: SupabaseClient<Database>;
let editorId: string;

beforeAll(async () => {
	editorId = await ensureUser(EDITOR, { editor: true });
	await ensureUser(VIEWER, { editor: false });
	editor = await signedInClient(EDITOR);
	viewer = await signedInClient(VIEWER);
});

beforeEach(async () => {
	await resetCatalog();
});

describe('plant service', () => {
	it('lets the editor create, read, update and delete a plant, which starts as a manual draft', async () => {
		const id = randomUUID();
		await createPlant(editor, id, base);

		expect(await listPlants(editor)).toEqual([
			{
				id,
				scientific_name: 'Bellis perennis',
				name_bg: 'Паричка',
				family: 'Asteraceae',
				name_source: 'manual',
				id_status: 'draft',
				primaryThumbPath: null
			}
		]);

		await updatePlant(editor, id, { ...base, name_bg: 'Обикновена паричка' });
		const updated = await getPlant(editor, id);
		expect(updated?.name_bg).toBe('Обикновена паричка');
		expect(updated?.id_status).toBe('draft');

		await deletePlant(editor, id);
		expect(await getPlant(editor, id)).toBeNull();
	});

	it('records an AI name source on create and keeps it when updating without one', async () => {
		const id = randomUUID();
		await createPlant(editor, id, base, 'ai');
		expect((await listPlants(editor))[0]).toMatchObject({ id, name_source: 'ai', id_status: 'draft' });

		await updatePlant(editor, id, { ...base, description: 'Розетка.' });
		const kept = await getPlant(editor, id);
		expect(kept?.name_source).toBe('ai');
		expect(kept?.description).toBe('Розетка.');

		await updatePlant(editor, id, base, 'manual');
		expect((await getPlant(editor, id))?.name_source).toBe('manual');
	});

	it('returns the primary photo thumb in the list and photos ordered primary-first', async () => {
		const id = randomUUID();
		await createPlant(editor, id, base);
		const admin = adminClient();
		const photoIds = [randomUUID(), randomUUID()];
		for (const [index, photoId] of photoIds.entries()) {
			const { error } = await admin.from('plant_photos').insert({
				id: photoId,
				plant_id: id,
				owner_id: editorId,
				path: `${editorId}/${id}/${photoId}.webp`,
				thumb_path: `${editorId}/${id}/${photoId}_thumb.webp`,
				mime: 'image/webp',
				width: 100,
				height: 100,
				bytes: 10,
				sha256: String(index).repeat(64)
			});
			if (error) throw error;
		}
		const [item] = await listPlants(editor);
		expect(item.primaryThumbPath).toBe(`${editorId}/${id}/${photoIds[0]}_thumb.webp`);
		const plant = await getPlant(editor, id);
		expect(plant?.photos.map((p) => p.id)).toEqual(photoIds);
		expect(plant?.photos[0].is_primary).toBe(true);
	});

	it('returns null for unknown or malformed ids', async () => {
		expect(await getPlant(editor, randomUUID())).toBeNull();
		expect(await getPlant(editor, 'not-a-uuid')).toBeNull();
	});

	it('refuses every write from a viewer with a Bulgarian message', async () => {
		const id = randomUUID();
		await createPlant(editor, id, base);

		await expect(createPlant(viewer, randomUUID(), base)).rejects.toThrow(
			new UserFacingError('Нямаш права за това действие.')
		);
		await expect(updatePlant(viewer, id, { ...base, name_bg: 'X' })).rejects.toBeInstanceOf(UserFacingError);
		await expect(deletePlant(viewer, id)).rejects.toBeInstanceOf(UserFacingError);

		const unchanged = await getPlant(viewer, id);
		expect(unchanged?.name_bg).toBe('Паричка');
		expect(unchanged?.id_status).toBe('draft');
	});

	describe('deleting a plant with photos', () => {
		async function plantWithPhotos(): Promise<{ id: string; photoIds: string[] }> {
			const id = randomUUID();
			await createPlant(editor, id, base);
			const photoIds = [randomUUID(), randomUUID()];
			for (const [index, photoId] of photoIds.entries()) {
				const { error } = await adminClient().from('plant_photos').insert({
					id: photoId,
					plant_id: id,
					owner_id: editorId,
					path: `${editorId}/${id}/${photoId}.webp`,
					thumb_path: `${editorId}/${id}/${photoId}_thumb.webp`,
					mime: 'image/webp',
					width: 100,
					height: 100,
					bytes: 10,
					sha256: String(index + 5).repeat(64)
				});
				if (error) throw error;
			}
			return { id, photoIds };
		}

		it('is fully removed by the editor, photo rows included', async () => {
			const { id } = await plantWithPhotos();
			await deletePlant(editor, id);
			expect(await getPlant(editor, id)).toBeNull();
			const { data, error } = await adminClient().from('plant_photos').select('id').eq('plant_id', id);
			if (error) throw error;
			expect(data).toEqual([]);
		});

		it('is refused for a viewer and leaves the plant and both photos in place', async () => {
			const { id, photoIds } = await plantWithPhotos();
			await expect(deletePlant(viewer, id)).rejects.toBeInstanceOf(UserFacingError);
			const plant = await getPlant(editor, id);
			expect(plant).not.toBeNull();
			expect(plant?.photos.map((p) => p.id).sort()).toEqual([...photoIds].sort());
		});
	});
});
