import { describe, expect, it, vi } from 'vitest';
import { runPrepare, type PrepareDeps } from '$lib/review/prepare';
import { fail, type IdentifyResult } from '$lib/identify/types';

const ok: IdentifyResult = { ok: true, modelVersion: 'v', candidates: [] };
const plants = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, photoUrl: `u${i}` }));

function deps(results: IdentifyResult[], overrides: Partial<PrepareDeps> = {}) {
	const queue = [...results];
	const save = vi.fn(async () => new Response('{}', { status: 200 }));
	const d: PrepareDeps = {
		fetchPhoto: async () => new Blob(['x']),
		identify: async () => ({ result: queue.shift()!, sent: 1 }),
		save,
		onProgress: () => {},
		signal: new AbortController().signal,
		...overrides
	};
	return { d, save };
}

describe('runPrepare', () => {
	it('stops on quota and keeps what was prepared', async () => {
		const { d } = deps([ok, fail('quota'), ok]);
		expect(await runPrepare(plants(3), d)).toEqual({ prepared: 1, skipped: 0, stoppedBy: 'quota' });
	});

	it('skips upstream errors and photo failures, then continues', async () => {
		let n = 0;
		const { d } = deps([fail('upstream'), ok], {
			fetchPhoto: async () => {
				n += 1;
				if (n === 2) throw new Error('404');
				return new Blob(['x']);
			}
		});
		expect(await runPrepare(plants(3), d)).toEqual({ prepared: 1, skipped: 2, stoppedBy: 'done' });
	});

	it('stores an unrecognised plant with no candidates', async () => {
		const { d, save } = deps([fail('no_match')]);
		await runPrepare(plants(1), d);
		expect(save).toHaveBeenCalledWith({ plantId: 'p0', modelVersion: null, photoCount: 1, candidates: [] });
	});

	it('stops when aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		const { d } = deps([ok], { signal: controller.signal });
		expect((await runPrepare(plants(2), d)).stoppedBy).toBe('aborted');
	});
});
