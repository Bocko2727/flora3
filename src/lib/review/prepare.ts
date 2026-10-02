import type { IdentifyResult } from '$lib/identify/types';

export type PreparePlant = { id: string; photoUrl: string | null };
export type PrepareStop = 'done' | 'quota' | 'forbidden' | 'not_configured' | 'aborted';
export type PrepareDeps = {
	fetchPhoto: (url: string) => Promise<Blob>;
	identify: (blobs: Blob[]) => Promise<{ result: IdentifyResult; sent: number }>;
	save: (body: { plantId: string; modelVersion: string | null; photoCount: number; candidates: unknown[] }) => Promise<Response>;
	onProgress: (done: number, total: number) => void;
	signal: AbortSignal;
};

/**
 * Runs Pl@ntNet on each plant's primary photo, one at a time, and stores the result undecided.
 * A plant Pl@ntNet does not recognise is stored with no candidates (so it is not asked again);
 * network and photo failures are skipped and retried on the next run; quota and rights stop the run.
 */
export async function runPrepare(
	plants: PreparePlant[],
	deps: PrepareDeps
): Promise<{ prepared: number; skipped: number; stoppedBy: PrepareStop }> {
	let prepared = 0;
	let skipped = 0;
	const total = plants.length;
	for (const [i, plant] of plants.entries()) {
		if (deps.signal.aborted) return { prepared, skipped, stoppedBy: 'aborted' };
		const step = async (): Promise<PrepareStop | null> => {
			if (!plant.photoUrl) return (skipped++, null);
			let blob: Blob;
			try {
				blob = await deps.fetchPhoto(plant.photoUrl);
			} catch {
				return (skipped++, null);
			}
			const { result, sent } = await deps.identify([blob]);
			let candidates: unknown[];
			let modelVersion: string | null = null;
			if (result.ok) {
				candidates = result.candidates;
				modelVersion = result.modelVersion;
			} else if (result.code === 'no_match') {
				candidates = [];
			} else if (result.code === 'quota' || result.code === 'forbidden' || result.code === 'not_configured') {
				return result.code;
			} else {
				return (skipped++, null);
			}
			const response = await deps.save({ plantId: plant.id, modelVersion, photoCount: Math.max(sent, 1), candidates });
			if (response.status === 403) return 'forbidden';
			if (response.ok) prepared++;
			else skipped++;
			return null;
		};
		const stop = await step();
		if (stop) return { prepared, skipped, stoppedBy: stop };
		deps.onProgress(i + 1, total);
	}
	return { prepared, skipped, stoppedBy: 'done' };
}
