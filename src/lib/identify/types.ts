import { z } from 'zod';
import type { NameSource } from '$lib/status';

// Shared with browser code: keep this module free of server-only imports.

export type Candidate = {
	scientific_name: string;
	authorship: string | null;
	family: string | null;
	genus: string | null;
	common_names: string[];
	score: number;
	gbif_key: number | null;
};

export type IdentifyErrorCode =
	| 'no_match'
	| 'quota'
	| 'not_configured'
	| 'upstream'
	| 'bad_request'
	| 'forbidden';

export type IdentifyOk = { ok: true; modelVersion: string | null; candidates: Candidate[] };
export type IdentifyFail = { ok: false; code: IdentifyErrorCode; message: string };
export type IdentifyResult = IdentifyOk | IdentifyFail;

export const IDENTIFY_MESSAGES: Record<IdentifyErrorCode, string> = {
	no_match: 'AI не разпозна растението. Попълни името сам.',
	quota: 'Лимитът за разпознаване за днес е изчерпан.',
	not_configured: 'AI разпознаването не е настроено.',
	upstream: 'AI не отговори.',
	bad_request: 'Снимките не можаха да се изпратят. Опитай пак.',
	forbidden: 'Нямаш права за това действие.'
};

export function fail(code: IdentifyErrorCode): IdentifyFail {
	return { ok: false, code, message: IDENTIFY_MESSAGES[code] };
}

// The database casts score to numeric and gbif_key to bigint, so malformed values must never get in.
const nullableText = z.string().max(200).nullable();

const candidateSchema = z.object({
	scientific_name: z.string().min(1).max(200),
	authorship: nullableText,
	family: nullableText,
	genus: nullableText,
	common_names: z.array(z.string().max(200)).max(20),
	score: z.number().finite().min(0).max(1),
	gbif_key: z.number().int().nullable()
});

export const identificationSchema = z
	.object({
		modelVersion: z.string().max(100).nullable(),
		photoCount: z.number().int().min(1).max(5),
		candidates: z.array(candidateSchema).max(10),
		chosenIndex: z.number().int().min(0).nullable()
	})
	.refine((v) => v.chosenIndex === null || v.chosenIndex < v.candidates.length, {
		message: 'chosenIndex е извън кандидатите.',
		path: ['chosenIndex']
	});

export type IdentificationInput = z.output<typeof identificationSchema>;

export function parseIdentificationField(raw: FormDataEntryValue | null): IdentificationInput | null {
	if (typeof raw !== 'string' || raw.trim() === '') return null;
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	const parsed = identificationSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function normalizeName(value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export function sameName(a: string, b: string): boolean {
	return normalizeName(a) === normalizeName(b);
}

export function deriveNameSource(
	ident: IdentificationInput | null,
	submittedName: string,
	previous: { name: string; source: NameSource } | null
): NameSource {
	if (ident && ident.chosenIndex !== null) {
		const chosen = ident.candidates[ident.chosenIndex];
		if (chosen && sameName(chosen.scientific_name, submittedName)) return 'ai';
	}
	if (previous && sameName(previous.name, submittedName)) return previous.source;
	return 'manual';
}
