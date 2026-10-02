import { error } from '@sveltejs/kit';
import { UserFacingError } from '$lib/errors';

export function toHttpError(e: unknown): never {
	if (e instanceof UserFacingError) {
		console.error(e.message, e.detail);
		error(500, e.message);
	}
	throw e;
}
