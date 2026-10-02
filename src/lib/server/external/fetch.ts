import { env } from '$env/dynamic/private';

// Server routes must hand this (never the global fetch) to external API clients, so that
// FLORA_OFFLINE_EXTERNAL=1 (set for e2e) guarantees no request ever leaves the machine.
export function externalFetch(): typeof fetch {
	if (env.FLORA_OFFLINE_EXTERNAL === '1') {
		return async () => {
			throw new Error('external network disabled (FLORA_OFFLINE_EXTERNAL)');
		};
	}
	return fetch;
}
