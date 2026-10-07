import { enhancedPath } from '$lib/photos/storage';
import type { Db } from '$lib/server/plants';

const PAGE = 1000;

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
		const names = new Set<string>();
		let failed = false;
		// A listing returns at most `PAGE` objects; read on until a short page.
		for (let offset = 0; ; offset += PAGE) {
			const { data, error } = await db.storage.from('photos').list(folder, { limit: PAGE, offset });
			if (error || !data) {
				console.error('Enhanced copies not listed for', folder, error);
				failed = true;
				break;
			}
			for (const entry of data) names.add(entry.name);
			if (data.length < PAGE) break;
		}
		if (failed) continue;
		for (const path of paths) {
			if (names.has(enhancedPath(path).slice(folder.length + 1))) found.add(path);
		}
	}
	return found;
}
