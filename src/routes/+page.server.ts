import { isNameSource } from '$lib/status';
import { listPlants } from '$lib/server/plants';
import { loadReview } from '$lib/server/review';
import { toHttpError } from '$lib/server/http';
import { signPaths } from '$lib/server/signed-urls';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const plants = await listPlants(locals.supabase).catch(toHttpError);
	const { isEditor } = await parent();
	let review: { toPrepare: number; toDecide: number } | null = null;
	if (isEditor) {
		const r = await loadReview(locals.supabase).catch(toHttpError);
		review = { toPrepare: r.toPrepare.length, toDecide: r.items.filter((i) => i.kind.kind !== 'none').length };
	}
	const urls = await signPaths(
		locals.supabase,
		plants.flatMap((plant) => (plant.primaryThumbPath ? [plant.primaryThumbPath] : []))
	).catch(toHttpError);
	return {
		review,
		plants: plants.map((plant) => ({
			id: plant.id,
			name_bg: plant.name_bg,
			scientific_name: plant.scientific_name,
			family: plant.family,
			id_status: plant.id_status,
			name_source: isNameSource(plant.name_source) ? plant.name_source : ('manual' as const),
			thumbUrl: plant.primaryThumbPath ? (urls.get(plant.primaryThumbPath) ?? null) : null,
			photoState: !plant.primaryThumbPath
				? ('none' as const)
				: urls.get(plant.primaryThumbPath)
					? ('ok' as const)
					: ('failed' as const)
		}))
	};
};
