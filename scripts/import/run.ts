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
	/** Optional report to fill in place, so a caller can still save it if the run throws. */
	report?: ImportReport;
};

export type SkippedPhoto = {
	plantId: string;
	url: string;
	sha256: string;
	reason: 'already-imported' | 'duplicate-of-other-plant';
	existingPlantId: string | null;
};

export type PlantOutcome = {
	plantId: string;
	name: string;
	status: 'created' | 'skippedExisting' | 'failed';
	photosCreated: number;
	photosSkipped: number;
	photosFailed: number;
};

export type ImportReport = {
	apply: boolean;
	// plants.total counts valid records only; invalid records are counted in plants.failed (and errors) but not in total.
	plants: { total: number; created: number; skippedExisting: number; failed: number };
	photos: { total: number; created: number; skippedDuplicate: number; failed: number };
	errors: { plantId: string | null; url?: string; message: string }[];
	skipped: SkippedPhoto[];
	outcomes: PlantOutcome[];
	plantsWithoutPhotos: string[];
};

const OWNER_ERROR = 'OWNER_USER_ID is not an editor in the target project. Use the owner\'s UID (the user in public.editors).';

/** Confirms the owner id belongs to an editor of the target project and returns the owner's email. */
export async function verifyOwner(db: SupabaseClient<Database>, ownerId: string): Promise<{ email: string }> {
	const editor = await db.from('editors').select('user_id').eq('user_id', ownerId).maybeSingle();
	if (editor.error) throw new Error(`Could not check editors: ${message(editor.error)}`);
	if (!editor.data) throw new Error(OWNER_ERROR);
	const user = await db.auth.admin.getUserById(ownerId);
	if (user.error || !user.data.user) throw new Error(OWNER_ERROR);
	return { email: user.data.user.email ?? '(no email)' };
}

export function emptyReport(apply: boolean): ImportReport {
	return {
		apply,
		plants: { total: 0, created: 0, skippedExisting: 0, failed: 0 },
		photos: { total: 0, created: 0, skippedDuplicate: 0, failed: 0 },
		errors: [],
		skipped: [],
		outcomes: [],
		plantsWithoutPhotos: []
	};
}

const RETRY_DELAYS_MS = [500, 1500];
const FETCH_TIMEOUT_MS = 30_000;

class HttpError extends Error {
	constructor(
		readonly status: number,
		url: string
	) {
		super(`HTTP ${status} for ${url}`);
	}
}

function message(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (typeof e === 'object' && e !== null && 'message' in e) return String((e as { message: unknown }).message);
	return String(e);
}

// Client errors will not fix themselves, except "request timeout" and "too many requests".
function isRetryable(e: unknown): boolean {
	if (e instanceof HttpError && e.status >= 400 && e.status < 500) return e.status === 408 || e.status === 429;
	return true;
}

async function download(url: string, fetchImpl: typeof fetch): Promise<Buffer> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
		try {
			const response = await fetchImpl(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
			if (!response.ok) throw new HttpError(response.status, url);
			return Buffer.from(await response.arrayBuffer());
		} catch (e) {
			lastError = e;
			if (!isRetryable(e)) break;
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
	// sha256 -> plant that owns (or, in a dry-run, would own) the image within this run
	const shaToPlant = new Map<string, string>();
	const report = options.report ?? emptyReport(apply);

	async function cleanup(paths: string[], plantId: string, url: string) {
		const removed = await bucket.remove(paths);
		if (removed.error) {
			report.errors.push({ plantId, url, message: `Cleanup failed, remove manually: ${paths.join(', ')} (${message(removed.error)})` });
		}
	}

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
		const outcome: PlantOutcome = {
			plantId,
			name: mapped.plant.name_bg,
			status: 'created',
			photosCreated: 0,
			photosSkipped: 0,
			photosFailed: 0
		};
		report.outcomes.push(outcome);

		const failPlant = (error: unknown) => {
			outcome.status = 'failed';
			report.plants.failed++;
			report.errors.push({ plantId, message: message(error) });
			for (const url of mapped.photoUrls) {
				report.photos.failed++;
				outcome.photosFailed++;
				report.errors.push({ plantId, url, message: 'plant not imported' });
			}
		};

		const existing = await db.from('plants').select('id').eq('id', plantId).maybeSingle();
		if (existing.error) {
			failPlant(existing.error);
			continue;
		}
		if (existing.data) {
			outcome.status = 'skippedExisting';
			report.plants.skippedExisting++;
		} else {
			if (apply) {
				const inserted = await db.from('plants').insert(mapped.plant);
				if (inserted.error) {
					failPlant(inserted.error);
					continue;
				}
			}
			report.plants.created++;
		}
		log(`${apply ? 'plant' : 'plant (dry-run)'} ${plantId} ${mapped.plant.name_bg}`);

		for (const url of mapped.photoUrls) {
			try {
				const image = await processLegacyImage(await download(url, fetchImpl));
				const duplicate = await db.from('plant_photos').select('id, plant_id').eq('sha256', image.sha256).maybeSingle();
				if (duplicate.error) throw duplicate.error;
				const ownerPlantId = duplicate.data?.plant_id ?? shaToPlant.get(image.sha256) ?? null;
				if (ownerPlantId !== null) {
					report.photos.skippedDuplicate++;
					outcome.photosSkipped++;
					report.skipped.push({
						plantId,
						url,
						sha256: image.sha256,
						reason: ownerPlantId === plantId ? 'already-imported' : 'duplicate-of-other-plant',
						existingPlantId: ownerPlantId
					});
					continue;
				}
				if (apply) {
					const photoId = randomUUID();
					const path = `${ownerId}/${plantId}/${photoId}.webp`;
					const thumbPath = `${ownerId}/${plantId}/${photoId}_thumb.webp`;
					const uploadOptions = { contentType: 'image/webp', upsert: false, cacheControl: '31536000' };
					const full = await bucket.upload(path, image.full, uploadOptions);
					if (full.error) throw full.error;
					const thumb = await bucket.upload(thumbPath, image.thumb, uploadOptions);
					if (thumb.error) {
						await cleanup([path], plantId, url);
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
						await cleanup([path, thumbPath], plantId, url);
						throw row.error;
					}
				}
				// Only after a successful insert (or immediately in a dry-run, which inserts nothing).
				shaToPlant.set(image.sha256, plantId);
				report.photos.created++;
				outcome.photosCreated++;
			} catch (e) {
				report.photos.failed++;
				outcome.photosFailed++;
				report.errors.push({ plantId, url, message: message(e) });
			}
		}

		// Plants (created or existing) that end the run with no photo. In a dry-run the rows were not written,
		// so the would-create count is added to what is already in the database.
		const stored = await db.from('plant_photos').select('*', { count: 'exact', head: true }).eq('plant_id', plantId);
		if (stored.error) {
			report.errors.push({ plantId, message: `Could not count photos: ${message(stored.error)}` });
		} else if ((stored.count ?? 0) + (apply ? 0 : outcome.photosCreated) === 0) {
			report.plantsWithoutPhotos.push(plantId);
		}
	}
	return report;
}
