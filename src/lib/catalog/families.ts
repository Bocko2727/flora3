/**
 * Families are stored as free text (e.g. "Asteraceae (Сложноцветни)", "Onagraceae",
 * "Точеникови (Apocynaceae)"). These helpers only read that text for grouping and display;
 * they never write back or "correct" the stored value.
 */

export type ParsedFamily = { latin: string | null; bg: string | null };
export type FamilyGroup = { latin: string; bg: string | null; count: number };

const LATIN_FAMILY = /\b[A-Z][a-z]+aceae\b/g;
const BG_IN_BRACKETS = /\(([А-Яа-яЁё][А-Яа-яЁё\s-]*)\)/;
const BG_BEFORE_BRACKETS = /^([А-Яа-яЁё][А-Яа-яЁё\s-]*?)\s*\(/;

export function parseFamily(raw: string | null | undefined): ParsedFamily {
	const text = (raw ?? '').trim();
	if (text === '') return { latin: null, bg: null };
	if (/^Fungi\b/.test(text)) return { latin: 'Fungi', bg: text.match(BG_IN_BRACKETS)?.[1]?.trim() ?? null };
	const latinMatches = text.match(LATIN_FAMILY);
	const latin = latinMatches ? latinMatches[latinMatches.length - 1] : null;
	if (!latin) return { latin: null, bg: null };
	const bg = (text.match(BG_IN_BRACKETS)?.[1] ?? text.match(BG_BEFORE_BRACKETS)?.[1] ?? '').trim();
	return { latin, bg: bg === '' ? null : bg };
}

/** URL-safe check for a family key: a Latin family name or "Fungi". */
export function isFamilyKey(value: string): boolean {
	return /^[A-Z][a-z]{2,40}$/.test(value);
}

export function familyGroups(plants: readonly { family: string | null }[]): FamilyGroup[] {
	const groups = new Map<string, FamilyGroup>();
	for (const plant of plants) {
		const { latin, bg } = parseFamily(plant.family);
		if (!latin) continue;
		const group = groups.get(latin) ?? { latin, bg: null, count: 0 };
		group.count += 1;
		group.bg ??= bg;
		groups.set(latin, group);
	}
	return [...groups.values()].sort((a, b) => b.count - a.count || a.latin.localeCompare(b.latin));
}

export function inFamily(family: string | null, key: string): boolean {
	return parseFamily(family).latin === key;
}
