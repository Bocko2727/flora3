import { fail, type Candidate, type IdentifyResult } from '$lib/identify/types';

const PLANTNET_URL = 'https://my-api.plantnet.org/v2/identify/all';
const TIMEOUT_MS = 15_000;
const MAX_CANDIDATES = 5;

type Json = Record<string, unknown>;

function isObject(v: unknown): v is Json {
	return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function text(v: unknown): string | null {
	if (typeof v !== 'string') return null;
	const t = v.trim();
	return t !== '' && t.length <= 200 ? t : null;
}

function rankName(v: unknown): string | null {
	return isObject(v) ? text(v.scientificNameWithoutAuthor) : null;
}

function gbifKey(v: unknown): number | null {
	const raw = isObject(v) ? v.id : null;
	const n = typeof raw === 'string' && /^\d{1,15}$/.test(raw) ? Number(raw) : raw;
	return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null;
}

function parseCandidate(item: unknown): Candidate | null {
	if (!isObject(item) || !isObject(item.species)) return null;
	const score = item.score;
	if (typeof score !== 'number' || !Number.isFinite(score)) return null;
	const species = item.species;
	const name = text(species.scientificNameWithoutAuthor);
	if (!name) return null;
	const common = Array.isArray(species.commonNames) ? species.commonNames : [];
	return {
		scientific_name: name,
		authorship: text(species.scientificNameAuthorship),
		family: rankName(species.family),
		genus: rankName(species.genus),
		common_names: common.flatMap((c) => text(c) ?? []).slice(0, 20),
		score: Math.min(1, Math.max(0, score)),
		gbif_key: gbifKey(item.gbif)
	};
}

export function parsePlantNetResponse(json: unknown): {
	modelVersion: string | null;
	candidates: Candidate[];
} {
	if (!isObject(json)) return { modelVersion: null, candidates: [] };
	const version = typeof json.version === 'string' ? json.version.slice(0, 100) : null;
	const results = Array.isArray(json.results) ? json.results : [];
	const candidates = results
		.flatMap((r) => parseCandidate(r) ?? [])
		.sort((a, b) => b.score - a.score)
		.slice(0, MAX_CANDIDATES);
	return { modelVersion: version, candidates };
}

export async function identifyWithPlantNet(
	images: Blob[],
	apiKey: string,
	fetchFn: typeof fetch = fetch
): Promise<IdentifyResult> {
	const form = new FormData();
	images.forEach((image, i) => {
		form.append('images', image, `photo-${i + 1}.jpg`);
		form.append('organs', 'auto');
	});
	const url = `${PLANTNET_URL}?api-key=${apiKey}&nb-results=5&include-related-images=false`;

	let response: Response;
	try {
		response = await fetchFn(url, {
			method: 'POST',
			body: form,
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (error) {
		// Only the error name is logged: the message of a failed request may contain the URL (and the key).
		console.error('Pl@ntNet request failed:', error instanceof Error ? error.name : 'unknown');
		return fail('upstream');
	}

	if (response.status === 404) return fail('no_match');
	if (response.status === 429) return fail('quota');
	if (response.status === 401 || response.status === 403) return fail('not_configured');
	if (!response.ok) {
		console.error('Pl@ntNet responded with HTTP', response.status);
		return fail('upstream');
	}

	let body: unknown;
	try {
		body = await response.json();
	} catch {
		console.error('Pl@ntNet returned a non-JSON body.');
		return fail('upstream');
	}
	const { modelVersion, candidates } = parsePlantNetResponse(body);
	if (candidates.length === 0) return fail('no_match');
	return { ok: true, modelVersion, candidates };
}
