import { z } from 'zod';
import type { Database } from '../../src/lib/database.types';

export type PlantInsert = Database['public']['Tables']['plants']['Insert'];

const optional = z.string().nullable().optional();
const AI_KEYS = ['recognition', 'habitat', 'lookalikes', 'benefits', 'risks', 'uses', 'fun_fact'] as const;

export const legacyPlantSchema = z.object({
	id: z.uuid(),
	common_name: z.string().trim().min(1).max(200),
	latin_name: z.string().trim().min(1).max(200),
	family: z.string().trim().max(100).nullable().optional(),
	photos: z.array(z.string()).nullish().transform((v) => v ?? []),
	confidence: optional,
	recognition: optional,
	habitat: optional,
	lookalikes: optional,
	benefits: optional,
	risks: optional,
	uses: optional,
	fun_fact: optional,
	source_file: optional
});

export function mapLegacyPlant(
	raw: unknown,
	ownerId: string,
	importedAt: string
): { plant: PlantInsert; photoUrls: string[] } {
	const legacy = legacyPlantSchema.parse(raw);
	const legacyAi: Record<string, string> = {};
	for (const key of AI_KEYS) {
		const value = legacy[key]?.trim();
		if (value) legacyAi[key] = value;
	}
	const confidence = legacy.confidence?.trim();
	if (confidence) legacyAi.confidence = confidence;
	const sourceFile = legacy.source_file?.trim();
	if (sourceFile) legacyAi.source_file = sourceFile;
	legacyAi.legacy_id = legacy.id;
	legacyAi.imported_at = importedAt;

	return {
		plant: {
			id: legacy.id,
			owner_id: ownerId,
			name_bg: legacy.common_name,
			scientific_name: legacy.latin_name,
			family: legacy.family || null,
			description: null,
			habitat: null,
			notes: null,
			name_source: 'legacy_ai',
			legacy_ai: legacyAi
		},
		photoUrls: [...new Set(legacy.photos.map((url) => url.trim()).filter(Boolean))]
	};
}
