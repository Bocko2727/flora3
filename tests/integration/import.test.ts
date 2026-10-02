import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { importLegacy } from '../../scripts/import/run';
import { EDITOR, adminClient, ensureUser, resetCatalog } from '../helpers/supabase';

let server: Server;
let baseUrl: string;
let ownerId: string;
const images = new Map<string, Buffer>();

beforeAll(async () => {
	ownerId = await ensureUser(EDITOR, { editor: true });
	images.set('/a.jpg', await sharp({ create: { width: 3200, height: 2400, channels: 3, background: '#2f6b3a' } }).jpeg().toBuffer());
	images.set('/b.jpg', await sharp({ create: { width: 800, height: 600, channels: 3, background: '#c9a227' } }).jpeg().toBuffer());
	images.set('/a-copy.jpg', images.get('/a.jpg')!);
	images.set(
		'/rotated.jpg',
		await sharp({ create: { width: 400, height: 300, channels: 3, background: '#7a3f8c' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer()
	);
	server = createServer((req, res) => {
		const body = images.get(req.url ?? '');
		if (!body) {
			res.writeHead(404).end();
			return;
		}
		res.writeHead(200, { 'content-type': 'image/jpeg' }).end(body);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(async () => {
	await resetCatalog();
});

function records() {
	return [
		{ id: 'aaaaaaaa-0000-4000-8000-000000000001', common_name: 'Лайка', latin_name: 'Matricaria chamomilla', family: 'Asteraceae',
		  photos: [`${baseUrl}/a.jpg`, `${baseUrl}/b.jpg`], risks: 'Алергии', confidence: 'Потвърдено (AI 90%)' },
		{ id: 'aaaaaaaa-0000-4000-8000-000000000002', common_name: 'Мащерка', latin_name: 'Thymus serpyllum',
		  photos: [`${baseUrl}/rotated.jpg`, `${baseUrl}/missing.jpg`] },
		{ id: 'aaaaaaaa-0000-4000-8000-000000000003', common_name: 'Без латинско' }
	];
}

describe('importLegacy', () => {
	it('dry-run validates everything and writes nothing', async () => {
		const report = await importLegacy({ records: records(), db: adminClient(), ownerId, apply: false });
		expect(report.apply).toBe(false);
		expect(report.plants).toEqual({ total: 2, created: 2, skippedExisting: 0, failed: 1 });
		expect(report.photos).toEqual({ total: 4, created: 3, skippedDuplicate: 0, failed: 1 });
		expect(report.plantsWithoutPhotos).toEqual([]);
		expect(report.outcomes).toEqual([
			{ plantId: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Лайка', status: 'created', photosCreated: 2, photosSkipped: 0, photosFailed: 0 },
			{ plantId: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Мащерка', status: 'created', photosCreated: 1, photosSkipped: 0, photosFailed: 1 }
		]);
		const admin = adminClient();
		const { count } = await admin.from('plants').select('*', { count: 'exact', head: true });
		expect(count).toBe(0);
		const photoRows = await admin.from('plant_photos').select('*', { count: 'exact', head: true });
		expect(photoRows.count).toBe(0);
		const objects = await admin.storage.from('photos').list('');
		expect(objects.error).toBeNull();
		expect(objects.data).toEqual([]);
	});

	it('imports plants and photos, then a second run changes nothing', async () => {
		const first = await importLegacy({ records: records(), db: adminClient(), ownerId, apply: true });
		expect(first.plants).toEqual({ total: 2, created: 2, skippedExisting: 0, failed: 1 });
		expect(first.photos).toEqual({ total: 4, created: 3, skippedDuplicate: 0, failed: 1 });
		expect(first.errors.map((e) => e.plantId)).toEqual(['aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000003']);

		expect(first.outcomes).toEqual([
			{ plantId: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Лайка', status: 'created', photosCreated: 2, photosSkipped: 0, photosFailed: 0 },
			{ plantId: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Мащерка', status: 'created', photosCreated: 1, photosSkipped: 0, photosFailed: 1 }
		]);
		expect(first.plantsWithoutPhotos).toEqual([]);
		expect(first.skipped).toEqual([]);

		const admin = adminClient();
		const { data: plant } = await admin.from('plants').select('*').eq('id', 'aaaaaaaa-0000-4000-8000-000000000001').single();
		expect(plant).toMatchObject({ status: 'unverified', confirmed_at: null, owner_id: ownerId, description: null });
		expect(plant?.legacy_ai).toMatchObject({ risks: 'Алергии', confidence: 'Потвърдено (AI 90%)' });

		const { data: photos } = await admin
			.from('plant_photos')
			.select('plant_id, is_primary, width, height, mime, path')
			.order('created_at');
		expect(photos?.length).toBe(3);
		const chamomile = photos!.filter((p) => p.plant_id === 'aaaaaaaa-0000-4000-8000-000000000001');
		expect(chamomile.map((p) => [p.is_primary, p.width, p.height])).toEqual([[true, 2560, 1920], [false, 800, 600]]);
		const thyme = photos!.find((p) => p.plant_id === 'aaaaaaaa-0000-4000-8000-000000000002');
		expect([thyme?.is_primary, thyme?.width, thyme?.height]).toEqual([true, 300, 400]);
		expect(photos!.every((p) => p.mime === 'image/webp' && p.path.startsWith(`${ownerId}/`))).toBe(true);

		const { data: file } = await admin.storage.from('photos').download(chamomile[0].path);
		const meta = await sharp(Buffer.from(await file!.arrayBuffer())).metadata();
		expect(meta.format).toBe('webp');
		expect(meta.exif).toBeUndefined();

		const second = await importLegacy({ records: records(), db: admin, ownerId, apply: true });
		expect(second.plants).toEqual({ total: 2, created: 0, skippedExisting: 2, failed: 1 });
		expect(second.photos).toEqual({ total: 4, created: 0, skippedDuplicate: 3, failed: 1 });
		expect(second.skipped.map((x) => [x.plantId, x.reason, x.existingPlantId])).toEqual([
			['aaaaaaaa-0000-4000-8000-000000000001', 'already-imported', 'aaaaaaaa-0000-4000-8000-000000000001'],
			['aaaaaaaa-0000-4000-8000-000000000001', 'already-imported', 'aaaaaaaa-0000-4000-8000-000000000001'],
			['aaaaaaaa-0000-4000-8000-000000000002', 'already-imported', 'aaaaaaaa-0000-4000-8000-000000000002']
		]);
		expect(second.outcomes.map((o) => [o.status, o.photosCreated, o.photosSkipped, o.photosFailed])).toEqual([
			['skippedExisting', 0, 2, 0],
			['skippedExisting', 0, 1, 1]
		]);
		expect(second.plantsWithoutPhotos).toEqual([]);
		const { count } = await admin.from('plant_photos').select('*', { count: 'exact', head: true });
		expect(count).toBe(3);
	});

	it('reports a plant left without photos when another plant already holds identical bytes', async () => {
		const twins = [
			{ id: 'aaaaaaaa-0000-4000-8000-000000000001', common_name: 'Първа', latin_name: 'Prima plantae', photos: [`${baseUrl}/a.jpg`] },
			{ id: 'aaaaaaaa-0000-4000-8000-000000000002', common_name: 'Втора', latin_name: 'Secunda plantae', photos: [`${baseUrl}/a-copy.jpg`] }
		];
		const report = await importLegacy({ records: twins, db: adminClient(), ownerId, apply: true });
		expect(report.photos).toEqual({ total: 2, created: 1, skippedDuplicate: 1, failed: 0 });
		expect(report.skipped).toHaveLength(1);
		expect(report.skipped[0]).toMatchObject({
			plantId: 'aaaaaaaa-0000-4000-8000-000000000002',
			url: `${baseUrl}/a-copy.jpg`,
			reason: 'duplicate-of-other-plant',
			existingPlantId: 'aaaaaaaa-0000-4000-8000-000000000001'
		});
		expect(report.skipped[0].sha256).toMatch(/^[0-9a-f]{64}$/);
		expect(report.plantsWithoutPhotos).toEqual(['aaaaaaaa-0000-4000-8000-000000000002']);
		expect(report.errors).toEqual([]);
	});

	it('counts the photos of a plant that could not be inserted as failed', async () => {
		// An owner id that does not exist violates the foreign key, so the plant insert is refused.
		const report = await importLegacy({
			records: [{ id: 'aaaaaaaa-0000-4000-8000-000000000004', common_name: 'Невъзможна', latin_name: 'Thymus', photos: [`${baseUrl}/b.jpg`] }],
			db: adminClient(),
			ownerId: '99999999-9999-4999-8999-999999999999',
			apply: true
		});
		expect(report.plants).toEqual({ total: 1, created: 0, skippedExisting: 0, failed: 1 });
		expect(report.photos).toEqual({ total: 1, created: 0, skippedDuplicate: 0, failed: 1 });
		expect(report.errors.map((e) => e.message)).toContain('plant not imported');
		expect(report.outcomes[0]).toMatchObject({ status: 'failed', photosFailed: 1 });
		expect(report.plantsWithoutPhotos).toEqual([]);
	});
});
