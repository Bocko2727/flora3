import { describe, expect, it, vi } from 'vitest';
import { fail, type IdentifyOk, type IdentifyResult } from '$lib/identify/types';
import { analyzeDrafts, type DraftState } from '$lib/upload/queue';
import type { Draft } from '$lib/upload/drafts';

const okResult: IdentifyOk = {
	ok: true,
	modelVersion: 'm',
	candidates: [
		{ scientific_name: 'Bellis perennis', authorship: null, family: 'Asteraceae', genus: 'Bellis', common_names: [], score: 0.7, gbif_key: 1 }
	]
};

const draft = (id: string): Draft => ({ id, files: [new File(['x'], `${id}.jpg`, { type: 'image/jpeg' })] });

function setup(results: Array<{ result: IdentifyResult; sent: number }>) {
	const calls: string[] = [];
	const states = new Map<string, DraftState[]>();
	const run = vi.fn(async (files: File[]) => {
		calls.push(files[0].name);
		return results[calls.length - 1];
	});
	const onState = (id: string, state: DraftState) => states.set(id, [...(states.get(id) ?? []), state]);
	return { calls, states, run, onState };
}

const last = (states: Map<string, DraftState[]>, id: string) => states.get(id)?.at(-1);

describe('analyzeDrafts', () => {
	it('sends one request per draft, one at a time, in order', async () => {
		let active = 0;
		let maxActive = 0;
		const order: string[] = [];
		const run = async (files: File[]) => {
			active += 1;
			maxActive = Math.max(maxActive, active);
			order.push(files[0].name);
			await new Promise((r) => setTimeout(r, 1));
			active -= 1;
			return { result: okResult, sent: 1 };
		};
		await analyzeDrafts([draft('a'), draft('b'), draft('c')], run, () => {});
		expect(order).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
		expect(maxActive).toBe(1);
	});

	it('marks a draft loading and then ok with the candidates', async () => {
		const s = setup([{ result: okResult, sent: 1 }]);
		await analyzeDrafts([draft('a')], s.run, s.onState);
		expect(s.states.get('a')?.map((x) => x.phase)).toEqual(['loading', 'ok']);
		expect(last(s.states, 'a')).toMatchObject({ phase: 'ok', sent: 1, result: okResult });
	});

	it('stops at the first quota error and leaves the rest unsent', async () => {
		const s = setup([{ result: okResult, sent: 1 }, { result: fail('quota'), sent: 1 }, { result: okResult, sent: 1 }]);
		await analyzeDrafts([draft('a'), draft('b'), draft('c'), draft('d')], s.run, s.onState);
		expect(s.calls).toEqual(['a.jpg', 'b.jpg']);
		expect(last(s.states, 'b')).toMatchObject({ phase: 'error', code: 'quota' });
		expect(last(s.states, 'c')).toMatchObject({ phase: 'skipped' });
		expect(last(s.states, 'd')).toMatchObject({ phase: 'skipped' });
	});

	it.each(['forbidden', 'not_configured', 'upstream'] as const)('also stops on %s (every further request would be wasted or spend quota)', async (code) => {
		const s = setup([{ result: fail(code), sent: 1 }, { result: okResult, sent: 1 }]);
		await analyzeDrafts([draft('a'), draft('b')], s.run, s.onState);
		expect(s.calls).toEqual(['a.jpg']);
		expect(last(s.states, 'b')).toMatchObject({ phase: 'skipped' });
	});

	it('continues after no_match and after a draft that could not be converted (nothing was sent)', async () => {
		const s = setup([
			{ result: { ok: true, modelVersion: null, candidates: [] }, sent: 1 },
			{ result: fail('bad_request'), sent: 0 },
			{ result: okResult, sent: 1 }
		]);
		await analyzeDrafts([draft('a'), draft('b'), draft('c')], s.run, s.onState);
		expect(s.calls).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
		expect(last(s.states, 'a')).toMatchObject({ phase: 'error', code: 'no_match' });
		expect(last(s.states, 'b')).toMatchObject({ phase: 'error', code: 'bad_request' });
		expect(last(s.states, 'c')).toMatchObject({ phase: 'ok' });
	});

	it('never retries a failed draft by itself', async () => {
		const s = setup([{ result: fail('bad_request'), sent: 1 }]);
		await analyzeDrafts([draft('a')], s.run, s.onState);
		expect(s.run).toHaveBeenCalledTimes(1);
	});

	it('stops before the next draft when cancelled and sends nothing more', async () => {
		let cancelled = false;
		const s = setup([{ result: okResult, sent: 1 }, { result: okResult, sent: 1 }]);
		const run = async (files: File[]) => {
			const out = await s.run(files);
			cancelled = true;
			return out;
		};
		await analyzeDrafts([draft('a'), draft('b')], run, s.onState, () => cancelled);
		expect(s.calls).toEqual(['a.jpg']);
		expect(s.states.get('b')).toBeUndefined();
	});

	it('does nothing for an empty list', async () => {
		const s = setup([]);
		await analyzeDrafts([], s.run, s.onState);
		expect(s.run).not.toHaveBeenCalled();
	});
});
