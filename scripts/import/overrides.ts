import { z } from 'zod';

/**
 * Editor decisions applied to the legacy export before import. The old project is never changed;
 * an excluded plant can be imported later by removing its entry.
 */
const overridesSchema = z.strictObject({
	excludePlants: z.array(z.strictObject({ id: z.uuid(), reason: z.string().trim().min(1) })).default([]),
	dropPhotos: z
		.array(z.strictObject({ plantId: z.uuid(), url: z.url(), reason: z.string().trim().min(1) }))
		.default([])
});

export type Overrides = z.infer<typeof overridesSchema>;

export function parseOverrides(value: unknown): Overrides {
	return overridesSchema.parse(value);
}

type LegacyLike = { id?: unknown; latin_name?: unknown; photos?: unknown };

function label(record: LegacyLike): string {
	return typeof record.latin_name === 'string' ? record.latin_name.trim() : '?';
}

/** Returns new records with the overrides applied; throws if any override does not match the export. */
export function applyOverrides(records: unknown[], overrides: Overrides): { records: unknown[]; applied: string[] } {
	const byId = new Map<string, LegacyLike>();
	for (const r of records) {
		if (typeof r === 'object' && r !== null && 'id' in r) byId.set(String((r as LegacyLike).id), r as LegacyLike);
	}
	const excluded = new Set<string>();
	const applied: string[] = [];

	for (const { id, reason } of overrides.excludePlants) {
		const record = byId.get(id);
		if (!record) throw new Error(`Override: plant ${id} is not in the export`);
		excluded.add(id);
		applied.push(`exclude plant ${id} (${label(record)}): ${reason}`);
	}

	const drops = new Map<string, Set<string>>();
	for (const { plantId, url, reason } of overrides.dropPhotos) {
		if (excluded.has(plantId)) throw new Error(`Override: plant ${plantId} is excluded; do not also drop its photos`);
		const record = byId.get(plantId);
		const photos = Array.isArray(record?.photos) ? record.photos.map((p) => String(p).trim()) : [];
		if (!record || !photos.includes(url)) throw new Error(`Override: photo ${url} is not on plant ${plantId}`);
		if (!drops.has(plantId)) drops.set(plantId, new Set());
		drops.get(plantId)!.add(url);
		applied.push(`drop photo ${url} from plant ${plantId} (${label(record)}): ${reason}`);
	}

	const result = records.flatMap((r) => {
		const id = typeof r === 'object' && r !== null && 'id' in r ? String((r as LegacyLike).id) : null;
		if (id !== null && excluded.has(id)) return [];
		const dropped = id !== null ? drops.get(id) : undefined;
		if (!dropped) return [r];
		const record = r as LegacyLike;
		const photos = (record.photos as unknown[]).filter((p) => !dropped.has(String(p).trim()));
		return [{ ...record, photos }];
	});
	return { records: result, applied };
}
