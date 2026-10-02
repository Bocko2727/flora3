import { UserFacingError } from '$lib/errors';

const GBIF = 'https://api.gbif.org/v1';
const TIMEOUT_MS = 5_000;
const FAILURE = 'Името не можа да се провери в GBIF.';

export type GbifCheck = {
	match: 'accepted' | 'synonym' | 'doubtful' | 'none';
	key: number | null;
	acceptedKey: number | null;
	acceptedName: string | null;
	family: string | null;
};

const SPECIES_RANKS = new Set(['SPECIES', 'SUBSPECIES', 'VARIETY', 'FORM']);
const SYNONYM_STATUSES = new Set([
	'SYNONYM',
	'HETEROTYPIC_SYNONYM',
	'HOMOTYPIC_SYNONYM',
	'PROPARTE_SYNONYM'
]);

const NONE = { match: 'none', key: null, acceptedKey: null, canonicalName: null, family: null } as const;

function key(v: unknown): number | null {
	return typeof v === 'number' && Number.isSafeInteger(v) && v > 0 ? v : null;
}

export function mapGbifMatch(json: unknown): {
	match: GbifCheck['match'];
	key: number | null;
	acceptedKey: number | null;
	canonicalName: string | null;
	family: string | null;
} {
	if (typeof json !== 'object' || json === null) return NONE;
	const j = json as Record<string, unknown>;
	const usageKey = key(j.usageKey);
	if (j.matchType !== 'EXACT' || typeof j.rank !== 'string' || !SPECIES_RANKS.has(j.rank)) {
		return NONE;
	}
	if (usageKey === null || typeof j.status !== 'string') return NONE;
	const canonicalName = typeof j.canonicalName === 'string' ? j.canonicalName : null;
	const family = typeof j.family === 'string' && j.family !== '' ? j.family : null;
	if (j.status === 'ACCEPTED') {
		return { match: 'accepted', key: usageKey, acceptedKey: null, canonicalName, family };
	}
	if (SYNONYM_STATUSES.has(j.status)) {
		return { match: 'synonym', key: usageKey, acceptedKey: key(j.acceptedUsageKey), canonicalName, family };
	}
	if (j.status === 'DOUBTFUL') {
		return { match: 'doubtful', key: usageKey, acceptedKey: null, canonicalName, family };
	}
	return NONE;
}

async function getJson(url: string, fetchFn: typeof fetch): Promise<unknown> {
	let response: Response;
	try {
		response = await fetchFn(url, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch (error) {
		throw new UserFacingError(FAILURE, error);
	}
	if (!response.ok) throw new UserFacingError(FAILURE, { status: response.status, url });
	try {
		return await response.json();
	} catch (error) {
		throw new UserFacingError(FAILURE, error);
	}
}

export async function checkNameWithGbif(
	name: string,
	fetchFn: typeof fetch = fetch
): Promise<GbifCheck> {
	const matched = mapGbifMatch(
		await getJson(`${GBIF}/species/match?name=${encodeURIComponent(name)}&strict=true`, fetchFn)
	);
	let acceptedName: string | null = null;
	if (matched.match === 'synonym' && matched.acceptedKey !== null) {
		const species = await getJson(`${GBIF}/species/${matched.acceptedKey}`, fetchFn);
		const canonical =
			typeof species === 'object' && species !== null
				? (species as Record<string, unknown>).canonicalName
				: null;
		acceptedName = typeof canonical === 'string' && canonical !== '' ? canonical : null;
	}
	return {
		match: matched.match,
		key: matched.key,
		acceptedKey: matched.acceptedKey,
		acceptedName,
		family: matched.family
	};
}
