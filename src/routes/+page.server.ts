import { listPlants } from '$lib/server/plants';
import { toHttpError } from '$lib/server/http';
import { signPaths } from '$lib/server/signed-urls';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const plants = await listPlants(locals.supabase).catch(toHttpError);
	const urls = await signPaths(
		locals.supabase,
		plants.flatMap((plant) => (plant.primaryThumbPath ? [plant.primaryThumbPath] : []))
	).catch(toHttpError);
	return {
		plants: plants.map((plant) => ({
			id: plant.id,
			name_bg: plant.name_bg,
			scientific_name: plant.scientific_name,
			status: plant.status,
			thumbUrl: plant.primaryThumbPath ? (urls.get(plant.primaryThumbPath) ?? null) : null
		}))
	};
};
