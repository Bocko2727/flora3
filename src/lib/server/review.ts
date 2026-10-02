import { UserFacingError, describeDbError } from '$lib/errors';
import type { Candidate } from '$lib/identify/types';
import { checkNameWithGbif } from '$lib/server/external/gbif';
import { findWiki, type WikiInfo } from '$lib/server/external/wiki';
import type { Database } from '$lib/database.types';
import type { Db } from '$lib/server/plants';
import { refreshNameCheck } from '$lib/server/verification';

export const MATCH_MIN = 0.3;

export type ReviewKind =
	| { kind: 'match'; index: number }
	| { kind: 'weak'; index: number; score: number }
	| { kind: 'mismatch'; sameGenus: number[] }
	| { kind: 'none' };

type NamedPlant = { scientific_name: string; gbif_key: number | null; gbif_accepted_key: number | null };

const ALREADY = 'Това растение вече е прегледано.';
const NOT_FOUND = 'Прегледът не е намерен или нямаш права за него.';
const NOT_A_MATCH = 'Кандидатът не съвпада със сегашното име.';

const words = (name: string) => name.trim().toLowerCase().split(/\s+/).filter(Boolean);
const genusOf = (name: string) => words(name)[0] ?? '';
/** "genus epithet" without the author; null for "Cistus sp." and other genus-only names. */
function speciesOf(name: string): string | null {
	const [genus, epithet] = words(name);
	if (!genus || !epithet || /^spp?\.?$/.test(epithet)) return null;
	return `${genus} ${epithet}`;
}

export function classify(plant: NamedPlant, candidates: Candidate[]): ReviewKind {
	if (candidates.length === 0) return { kind: 'none' };
	const keys = [plant.gbif_key, plant.gbif_accepted_key].filter((k): k is number => k !== null);
	const species = speciesOf(plant.scientific_name);
	const same = (c: Candidate) =>
		(c.gbif_key !== null && keys.includes(c.gbif_key)) ||
		(species !== null && speciesOf(c.scientific_name) === species);
	const strong = candidates.findIndex((c) => same(c) && c.score >= MATCH_MIN);
	if (strong >= 0) return { kind: 'match', index: strong };
	const weak = candidates.findIndex(same);
	if (weak >= 0) return { kind: 'weak', index: weak, score: candidates[weak].score };
	const genus = genusOf(plant.scientific_name);
	return { kind: 'mismatch', sameGenus: candidates.flatMap((c, i) => (genusOf(c.scientific_name) === genus ? [i] : [])) };
}

export type ReviewInput = { modelVersion: string | null; photoCount: number; candidates: Candidate[] };

async function plantOf(db: Db, plantId: string) {
	const { data, error } = await db
		.from('plants')
		.select('id, scientific_name, gbif_key, gbif_accepted_key')
		.eq('id', plantId)
		.maybeSingle();
	if (error) throw new UserFacingError(describeDbError(error, NOT_FOUND), error);
	if (!data) throw new UserFacingError(NOT_FOUND);
	return data;
}

async function hasReview(db: Db, plantId: string): Promise<boolean> {
	const { data, error } = await db.from('identifications').select('id').eq('plant_id', plantId).eq('source', 'review').limit(1);
	if (error) throw new UserFacingError(describeDbError(error, NOT_FOUND), error);
	return data.length > 0;
}

/** One Pl@ntNet result per legacy plant, stored undecided, with GBIF and Wikipedia checked for the current name. */
export async function prepareReview(
	db: Db,
	plantId: string,
	ident: ReviewInput,
	fetchFn: typeof fetch = fetch
): Promise<'prepared' | 'exists'> {
	if (await hasReview(db, plantId)) return 'exists';
	const before = await plantOf(db, plantId);
	await refreshNameCheck(db, plantId, before.scientific_name, fetchFn);
	const plant = await plantOf(db, plantId);
	const key = plant.gbif_accepted_key ?? plant.gbif_key;
	const wiki = key !== null ? await findWiki(key, fetchFn) : null;
	const { error } = await db.from('identifications').insert({
		plant_id: plantId,
		model_version: ident.modelVersion,
		photo_count: ident.photoCount,
		candidates: ident.candidates,
		source: 'review',
		wiki
	});
	if (error?.code === '23505') return 'exists';
	if (error) throw new UserFacingError(describeDbError(error, 'Предложението не можа да се запише.'), error);
	return 'prepared';
}

type PendingRow = {
	id: string;
	plant_id: string;
	candidates: Candidate[];
	wiki: WikiInfo | null;
	plant: NamedPlant;
};

async function pending(db: Db, identId: string): Promise<PendingRow> {
	const { data, error } = await db
		.from('identifications')
		.select('id, plant_id, candidates, wiki, source, decision, plants(scientific_name, gbif_key, gbif_accepted_key)')
		.eq('id', identId)
		.maybeSingle();
	if (error) throw new UserFacingError(describeDbError(error, NOT_FOUND), error);
	if (!data || data.source !== 'review' || !data.plants) throw new UserFacingError(NOT_FOUND);
	if (data.decision !== null) throw new UserFacingError(ALREADY);
	return {
		id: data.id,
		plant_id: data.plant_id,
		candidates: data.candidates as unknown as Candidate[],
		wiki: (data.wiki as unknown as WikiInfo | null) ?? null,
		plant: data.plants
	};
}

async function decide(db: Db, identId: string, values: { chosen_index?: number; decision: 'match' | 'changed' | 'kept' }) {
	const { data, error } = await db
		.from('identifications')
		.update(values)
		.eq('id', identId)
		.is('decision', null)
		.select('id');
	if (error) throw new UserFacingError(describeDbError(error, 'Решението не можа да се запише.'), error);
	if (data.length === 0) throw new UserFacingError(ALREADY);
}

type PlantUpdate = Database['public']['Tables']['plants']['Update'];

async function updatePlantRow(db: Db, plantId: string, values: PlantUpdate) {
	if (Object.keys(values).length === 0) return;
	const { data, error } = await db.from('plants').update(values).eq('id', plantId).select('id');
	if (error) throw new UserFacingError(describeDbError(error, 'Растението не можа да се обнови.'), error);
	if (data.length === 0) throw new UserFacingError(NOT_FOUND);
}

function wikiText(wiki: WikiInfo | null) {
	return wiki?.extract
		? { description: wiki.extract, description_source: 'wikipedia', wiki_url: wiki.url }
		: null;
}

export async function decideMatch(
	db: Db,
	identId: string,
	opts: { useWikiName: boolean; useWikiText: boolean }
): Promise<void> {
	const row = await pending(db, identId);
	const kind = classify(row.plant, row.candidates);
	if (kind.kind !== 'match') throw new UserFacingError(NOT_A_MATCH);
	const text = opts.useWikiText ? wikiText(row.wiki) : null;
	await updatePlantRow(db, row.plant_id, {
		...(opts.useWikiName && row.wiki?.name_bg ? { name_bg: row.wiki.name_bg } : {}),
		...(text ?? {})
	});
	await decide(db, identId, { chosen_index: kind.index, decision: 'match' });
}

export async function decideChange(
	db: Db,
	identId: string,
	index: number,
	opts: { nameBg: string | null; useWikiText: boolean },
	fetchFn: typeof fetch = fetch
): Promise<void> {
	const row = await pending(db, identId);
	const candidate = row.candidates[index];
	if (!Number.isInteger(index) || !candidate) throw new UserFacingError('Няма такъв кандидат.');

	let gbif: Awaited<ReturnType<typeof checkNameWithGbif>> | null = null;
	try {
		gbif = await checkNameWithGbif(candidate.scientific_name, fetchFn);
	} catch (e) {
		if (!(e instanceof UserFacingError)) throw e;
		console.error('GBIF name check failed', row.plant_id, e.detail ?? e.message);
	}
	const key = gbif ? (gbif.acceptedKey ?? gbif.key) : candidate.gbif_key;
	const text = opts.useWikiText && key !== null ? wikiText(await findWiki(key, fetchFn)) : null;
	const nameBg = opts.nameBg?.trim();

	await updatePlantRow(db, row.plant_id, {
		scientific_name: candidate.scientific_name,
		family: gbif?.family ?? candidate.family ?? null,
		name_bg: nameBg ? nameBg.slice(0, 200) : candidate.scientific_name,
		name_source: 'ai',
		description: text?.description ?? null,
		description_source: text?.description_source ?? null,
		wiki_url: text?.wiki_url ?? null,
		habitat: null,
		gbif_match: gbif?.match ?? null,
		gbif_key: gbif?.key ?? null,
		gbif_accepted_key: gbif?.acceptedKey ?? null,
		gbif_accepted_name: gbif?.acceptedName ?? null,
		gbif_checked_at: gbif ? new Date().toISOString() : null
	});
	await decide(db, identId, { chosen_index: index, decision: 'changed' });
}

export async function decideKeep(db: Db, identId: string): Promise<void> {
	await pending(db, identId);
	await decide(db, identId, { decision: 'kept' });
}

export type ReviewItem = {
	identId: string;
	plantId: string;
	scientific_name: string;
	name_bg: string;
	photoPath: string | null;
	thumbPath: string | null;
	candidates: Candidate[];
	kind: ReviewKind;
	wiki: WikiInfo | null;
	gbifMatch: string | null;
};

type PhotoRef = { path: string; thumb_path: string; is_primary: boolean };
const primary = (photos: PhotoRef[]) => photos.find((p) => p.is_primary) ?? photos[0] ?? null;

/** Legacy plants still to prepare (with a photo) and the review rows waiting for a decision. */
export async function loadReview(db: Db): Promise<{
	toPrepare: { id: string; photoPath: string }[];
	items: ReviewItem[];
	decided: number;
}> {
	const [legacy, reviews] = await Promise.all([
		db
			.from('plants')
			.select('id, scientific_name, plant_photos(path, thumb_path, is_primary), identifications(source)')
			.eq('name_source', 'legacy_ai')
			.order('scientific_name'),
		db
			.from('identifications')
			.select(
				'id, decision, candidates, wiki, plants(id, scientific_name, name_bg, gbif_key, gbif_accepted_key, gbif_match, plant_photos(path, thumb_path, is_primary))'
			)
			.eq('source', 'review')
	]);
	if (legacy.error) throw new UserFacingError(describeDbError(legacy.error, 'Прегледът не можа да се зареди.'), legacy.error);
	if (reviews.error) throw new UserFacingError(describeDbError(reviews.error, 'Прегледът не можа да се зареди.'), reviews.error);

	const toPrepare = legacy.data.flatMap((plant) => {
		if (plant.identifications.some((i) => i.source === 'review')) return [];
		const photo = primary(plant.plant_photos);
		return photo ? [{ id: plant.id, photoPath: photo.path }] : [];
	});
	let decided = 0;
	const items: ReviewItem[] = [];
	for (const row of reviews.data) {
		if (row.decision !== null) {
			decided += 1;
			continue;
		}
		if (!row.plants) continue;
		const candidates = row.candidates as unknown as Candidate[];
		const photo = primary(row.plants.plant_photos);
		items.push({
			identId: row.id,
			plantId: row.plants.id,
			scientific_name: row.plants.scientific_name,
			name_bg: row.plants.name_bg,
			photoPath: photo?.path ?? null,
			thumbPath: photo?.thumb_path ?? null,
			candidates,
			kind: classify(row.plants, candidates),
			wiki: (row.wiki as unknown as WikiInfo | null) ?? null,
			gbifMatch: row.plants.gbif_match
		});
	}
	items.sort((a, b) => a.scientific_name.localeCompare(b.scientific_name));
	return { toPrepare, items, decided };
}

/** Accepts every listed row that really is a match (with its Wikipedia text when there is one); returns how many. */
export async function matchAllReview(db: Db, identIds: string[]): Promise<number> {
	let done = 0;
	for (const identId of identIds) {
		try {
			await decideMatch(db, identId, { useWikiName: false, useWikiText: true });
			done += 1;
		} catch (e) {
			if (!(e instanceof UserFacingError)) throw e;
		}
	}
	return done;
}
