import { MAX_FILES_PER_BATCH } from '$lib/photos/process';

// Pure logic, safe for browser and tests: how a file selection becomes plant drafts.

export type UploadMode = 'one' | 'each';

export type Draft = { id: string; files: File[] };

export type DraftPlan = {
	drafts: Draft[];
	/** More files were chosen than one batch allows; the rest were left out. */
	tooMany: boolean;
	/** Files dropped because the same name, size and date was already chosen. */
	duplicates: number;
};

export function fileKey(file: File): string {
	return `${file.name}|${file.size}|${file.lastModified}`;
}

/**
 * "one": every file belongs to a single plant. "each": every file is its own plant.
 * One draft means exactly one Pl@ntNet request later, so the mode decides the request count.
 */
export function buildDrafts(
	files: File[],
	mode: UploadMode,
	makeId: () => string = () => crypto.randomUUID()
): DraftPlan {
	const seen = new Set<string>();
	const unique: File[] = [];
	let duplicates = 0;
	for (const file of files) {
		const key = fileKey(file);
		if (seen.has(key)) duplicates += 1;
		else {
			seen.add(key);
			unique.push(file);
		}
	}
	const tooMany = unique.length > MAX_FILES_PER_BATCH;
	const kept = unique.slice(0, MAX_FILES_PER_BATCH);
	if (kept.length === 0) return { drafts: [], tooMany, duplicates };
	const drafts: Draft[] =
		mode === 'one'
			? [{ id: makeId(), files: kept }]
			: kept.map((file) => ({ id: makeId(), files: [file] }));
	return { drafts, tooMany, duplicates };
}

/** One request per plant draft, never per file. */
export function requestCount(drafts: Draft[]): number {
	return drafts.filter((draft) => draft.files.length > 0).length;
}

/** Camera pictures arrive one at a time: they are added to the choice, never replace it. */
export function mergeSelection(current: File[], incoming: File[]): File[] {
	return incoming.length === 0 ? current : [...current, ...incoming];
}

/**
 * Cards are keyed by draft id, so a rebuild with fresh ids would wipe the names the owner already typed.
 * Within the same mode, a card that still exists keeps its id.
 */
export function keepIds(previous: Draft[], next: Draft[], mode: UploadMode): Draft[] {
	const used = new Set<string>();
	const claim = (id: string | undefined, fallback: string) => {
		const pick = id && !used.has(id) ? id : fallback;
		used.add(pick);
		return pick;
	};
	if (mode === 'one') {
		return next.map((draft, i) => ({ ...draft, id: claim(i === 0 ? previous[0]?.id : undefined, draft.id) }));
	}
	const byFile = new Map(previous.map((draft) => [draft.files[0] ? fileKey(draft.files[0]) : '', draft.id]));
	return next.map((draft) => ({ ...draft, id: claim(byFile.get(draft.files[0] ? fileKey(draft.files[0]) : ''), draft.id) }));
}
