import type { Database } from '$lib/database.types';

export type PlantRow = Database['public']['Tables']['plants']['Row'];
export type PhotoRow = Database['public']['Tables']['plant_photos']['Row'];

export const LEGACY_AI_FIELDS = [
	'recognition',
	'habitat',
	'lookalikes',
	'benefits',
	'risks',
	'uses',
	'fun_fact'
] as const;
export type LegacyAiField = (typeof LEGACY_AI_FIELDS)[number];

const LEGACY_META_FIELDS = ['confidence', 'source_file', 'legacy_id', 'imported_at'] as const;
type LegacyMetaField = (typeof LEGACY_META_FIELDS)[number];

export type LegacyAi = Partial<Record<LegacyAiField | LegacyMetaField, string>>;

export const AI_DRAFT_TITLE = 'AI чернова — непроверено';
export const AI_DRAFT_WARNING =
	'AI чернова — непроверено. Не е проверено от човек; не разчитай на него за ядливост, токсичност или лечебна употреба.';

export const LEGACY_AI_LABELS: Record<LegacyAiField, string> = {
	recognition: 'Разпознаване',
	habitat: 'Местообитание',
	lookalikes: 'Двойници',
	benefits: 'Ползи',
	risks: 'Рискове',
	uses: 'Употреба',
	fun_fact: 'Любопитен факт'
};

/** The old AI text is shown as answers to these questions; each answer stays marked as unverified. */
export const LEGACY_AI_QUESTIONS: Record<LegacyAiField, string> = {
	recognition: 'Как да го разпозная?',
	habitat: 'Къде расте?',
	lookalikes: 'С какво може да се сбърка?',
	benefits: 'Каква е ползата и ролята му в природата?',
	risks: 'Има ли рискове?',
	uses: 'За какво се използва?',
	fun_fact: 'Любопитен факт'
};

export function parseLegacyAi(value: unknown): LegacyAi | null {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	const source = value as Record<string, unknown>;
	const result: LegacyAi = {};
	for (const key of [...LEGACY_AI_FIELDS, ...LEGACY_META_FIELDS]) {
		const field = source[key];
		if (typeof field === 'string' && field.trim() !== '') result[key] = field;
	}
	return Object.keys(result).length > 0 ? result : null;
}
