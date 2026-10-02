import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/database.types';
import { processLegacyImage } from './image';
import { mapLegacyPlant } from './map';

export type ImportOptions = {
	records: unknown[];
	db: SupabaseClient<Database>;
	ownerId: string;
	apply: boolean;
	fetchImpl?: typeof fetch;
	now?: () => Date;
	log?: (line: string) => void;
};

export type ImportReport = {
	apply: boolean;
	plants: { total: number; created: number; skippedExisting: number; failed: number };
	photos: { total: number; created: number; skippedDuplicate: number; failed: number };
	errors: { plantId: string | null; url?: string; message: string }[];
};

const RETRY_DELAYS_MS = [500, 1500];

function message(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (typeof e === 'object' && e !== null && 'message' in e) return String((e as { message: unknown }).message);
	return String(e);
}

async function download(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
		try {
			const response = await fetchImpl(url);
			if (response.status === 404) throw new Error(`HTTP 404 for ${url}`);
			if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
			return Buffer.from(await response.arrayBuffer());
		} catch (e) {
			lastError = e;
			if (message(e).startsWith('HTTP 404')) break;
			if (attempt < RETRY_DELAYS_MS.length) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
		}
	}
	throw lastError;
}

export async function importLegacy(options: ImportOptions): Promise<ImportReport> {
	const { db, ownerId, apply } = options;
	const fetchImpl = options.fetchImpl ?? fetch;
	const log = options.log ?? (() => {});
	const importedAt = (options.now?.() ?? new Date()).toISOString();
	const bucket = db.storage.from('photos');
	const seenShas = new Set<string>();
	const report: ImportReport = {
		apply,
		plants: { total: 0, created: 0, skippedExisting: 0, failed: 0 },
		photos: { total: 0, created: 0, skippedDuplicate: 0, failed: 0 },
		errors: []
	};

	for (const raw of options.records) {
		const rawId = typeof raw === 'object' && raw !== null && 'id' in raw ? String((raw as { id: unknown }).id) : null;
		let mapped: ReturnType<typeof mapLegacyPlant>;
		try {
			mapped = mapLegacyPlant(raw, ownerId, importedAt);
		} catch (e) {
			report.plants.failed++;
			report.errors.push({ plantId: rawId, message: `Invalid record: ${message(e)}` });
			continue;
		}

		const plantId = mapped.plant.id;
		report.plants.total++;
		report.photos.total += mapped.photoUrls.length;

		const existing = await db.from('plants').select('id').eq('id', plantId).maybeSingle();
		if (existing.error) {
			report.plants.failed++;
			report.errors.push({ plantId, message: message(existing.error) });
			continue;
		}
		if (existing.data) {
			report.plants.skippedExisting++;
		} else {
			if (apply) {
				const inserted = await db.from('plants').insert(mapped.plant);
				if (inserted.error) {
					report.plants.failed++;
					report.errors.push({ plantId, message: message(inserted.error) });
					continue;
				}
			}
			report.plants.created++;
		}
		log(`${apply ? 'plant' : 'plant (dry-run)'} ${plantId} ${mapped.plant.name_bg}`);

		for (const url of mapped.photoUrls) {
			try {
				const image = await processLegacyImage(await download(url, fetchImpl));
				const duplicate = await db.from('plant_photos').select('id').eq('sha256', image.sha256).maybeSingle();
				if (duplicate.error) throw duplicate.error;
				if (duplicate.data || seenShas.has(image.sha256)) {
					report.photos.skippedDuplicate++;
					continue;
				}
				seenShas.add(image.sha256);
				if (apply) {
					const photoId = randomUUID();
					const path = `${ownerId}/${plantId}/${photoId}.webp`;
					const thumbPath = `${ownerId}/${plantId}/${photoId}_thumb.webp`;
					const uploadOptions = { contentType: 'image/webp', upsert: false, cacheControl: '31536000' };
					const full = await bucket.upload(path, image.full, uploadOptions);
					if (full.error) throw full.error;
					const thumb = await bucket.upload(thumbPath, image.thumb, uploadOptions);
					if (thumb.error) {
						await bucket.remove([path]);
						throw thumb.error;
					}
					const row = await db.from('plant_photos').insert({
						id: photoId,
						plant_id: plantId,
						owner_id: ownerId,
						path,
						thumb_path: thumbPath,
						mime: 'image/webp',
						width: image.width,
						height: image.height,
						bytes: image.full.length,
						sha256: image.sha256,
						taken_at: image.takenAt
					});
					if (row.error) {
						await bucket.remove([path, thumbPath]);
						throw row.error;
					}
				}
				report.photos.created++;
			} catch (e) {
				report.photos.failed++;
				report.errors.push({ plantId, url, message: message(e) });
			}
		}
	}
	return report;
}
