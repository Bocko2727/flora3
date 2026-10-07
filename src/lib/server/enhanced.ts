import { enhancedPath } from '$lib/photos/storage';
import type { Db } from '$lib/server/plants';

/**
 * Which original photo paths have an enhanced copy. One listing per folder (`owner/plant`).
 * A failed listing only hides the enhanced copies; the page keeps working with the originals.
 */
export async function findEnhanced(db: Db, originalPaths: string[]): Promise<Set<string>> {
	const byFolder = new Map<string, string[]>();
	for (const path of originalPaths) {
		const folder = path.slice(0, path.lastIndexOf('/'));
		byFolder.set(folder, [...(byFolder.get(folder) ?? []), path]);
	}
	const found = new Set<string>();
	for (const [folder, paths] of byFolder) {
		const { data, error } = await db.storage.from('photos').list(folder, { limit: 1000 });
		if (error || !data) {
			console.error('Enhanced copies not listed for', folder, error);
			continue;
		}
		const names = new Set(data.map((entry) => entry.name));
		for (const path of paths) {
			if (names.has(enhancedPath(path).slice(folder.length + 1))) found.add(path);
		}
	}
	return found;
}
