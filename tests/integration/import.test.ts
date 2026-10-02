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
		const { count } = await adminClient().from('plants').select('*', { count: 'exact', head: true });
		expect(count).toBe(0);
	});

	it('imports plants and photos, then a second run changes nothing', async () => {
		const first = await importLegacy({ records: records(), db: adminClient(), ownerId, apply: true });
		expect(first.plants).toEqual({ total: 2, created: 2, skippedExisting: 0, failed: 1 });
		expect(first.photos).toEqual({ total: 4, created: 3, skippedDuplicate: 0, failed: 1 });
		expect(first.errors.map((e) => e.plantId)).toEqual(['aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000003']);

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
		const { count } = await admin.from('plant_photos').select('*', { count: 'exact', head: true });
		expect(count).toBe(3);
	});
});
