export type IdStatus = 'draft' | 'ai_gbif' | 'community';
export type NameSource = 'manual' | 'ai' | 'legacy_ai';
export type StatusView = { tone: 'draft' | 'ai_gbif' | 'community'; label: string; explanation: string };

const ID_STATUSES: readonly string[] = ['draft', 'ai_gbif', 'community'];
const NAME_SOURCES: readonly string[] = ['manual', 'ai', 'legacy_ai'];

export function isIdStatus(v: unknown): v is IdStatus {
	return typeof v === 'string' && ID_STATUSES.includes(v);
}

export function isNameSource(v: unknown): v is NameSource {
	return typeof v === 'string' && NAME_SOURCES.includes(v);
}

export function statusView(status: IdStatus, nameSource: NameSource): StatusView {
	switch (status) {
		case 'community':
			return {
				tone: 'community',
				label: 'Потвърдено · iNaturalist',
				explanation: 'Наблюдение с Research Grade в iNaturalist за същия вид.'
			};
		case 'ai_gbif':
			return {
				tone: 'ai_gbif',
				label: 'AI · прието име',
				explanation: 'Името е валидно според GBIF. Видът е предложен от AI и не е потвърден от човек.'
			};
		case 'draft':
			return nameSource === 'manual'
				? { tone: 'draft', label: 'Чернова', explanation: 'Въведено ръчно. Не е проверено.' }
				: { tone: 'draft', label: 'AI чернова', explanation: 'Предложено от AI. Не е проверено от човек.' };
	}
}
