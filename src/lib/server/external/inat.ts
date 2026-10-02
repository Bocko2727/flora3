import { UserFacingError } from '$lib/errors';

const INAT = 'https://api.inaturalist.org/v1/observations';
const TIMEOUT_MS = 5_000;
const FAILURE = 'iNaturalist не отговори. Опитай пак.';
const ID_PATTERN = /^(?:https?:\/\/(?:www\.)?inaturalist\.org\/observations\/)?(\d{1,12})\/?$/;

export type InatObservation = {
	qualityGrade: 'research' | 'needs_id' | 'casual';
	taxonName: string | null;
};

export function parseInatObservationId(input: string): number | null {
	const match = ID_PATTERN.exec(input.trim());
	if (!match) return null;
	const id = Number(match[1]);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function fetchInatObservation(
	id: number,
	fetchFn: typeof fetch = fetch
): Promise<InatObservation | null> {
	let body: unknown;
	try {
		const response = await fetchFn(`${INAT}/${id}`, {
			headers: { accept: 'application/json' },
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		body = await response.json();
	} catch (error) {
		throw new UserFacingError(FAILURE, error);
	}

	const results =
		typeof body === 'object' && body !== null ? (body as Record<string, unknown>).results : null;
	if (!Array.isArray(results) || results.length === 0) return null;
	const first = results[0] as Record<string, unknown> | null;
	if (typeof first !== 'object' || first === null) return null;

	const grade = first.quality_grade;
	const taxon = first.taxon as Record<string, unknown> | null | undefined;
	const name = taxon && typeof taxon === 'object' ? taxon.name : null;
	return {
		qualityGrade: grade === 'research' || grade === 'needs_id' ? grade : 'casual',
		taxonName: typeof name === 'string' && name !== '' ? name : null
	};
}
