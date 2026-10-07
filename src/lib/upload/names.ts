// Only a hint for the owner: it never blocks saving and never merges anything.

export function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function findExisting<T extends { scientific_name: string }>(name: string, catalog: T[]): T | null {
	const wanted = normalizeName(name);
	if (!wanted) return null;
	return catalog.find((plant) => normalizeName(plant.scientific_name) === wanted) ?? null;
}
