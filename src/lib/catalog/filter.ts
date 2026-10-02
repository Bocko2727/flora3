export type StatusFilter = 'all' | 'unverified' | 'confirmed';

export function normalizeForSearch(value: string): string {
	return value.normalize('NFC').toLocaleLowerCase('bg').replace(/\s+/g, ' ').trim();
}

export function filterPlants<T extends { name_bg: string; scientific_name: string; status: string }>(
	plants: T[],
	query: string,
	status: StatusFilter
): T[] {
	const needle = normalizeForSearch(query);
	return plants.filter(
		(plant) =>
			(status === 'all' || plant.status === status) &&
			(needle === '' ||
				normalizeForSearch(plant.name_bg).includes(needle) ||
				normalizeForSearch(plant.scientific_name).includes(needle))
	);
}
