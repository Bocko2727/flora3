import { describe, expect, it, vi } from 'vitest';
import { findEnhanced } from '$lib/server/enhanced';
import type { Db } from '$lib/server/plants';

function fakeDb(folders: Record<string, string[] | Error>) {
	const list = vi.fn(async (folder: string, _options?: unknown) => {
		const entry = folders[folder];
		if (entry instanceof Error) return { data: null, error: entry };
		return { data: (entry ?? []).map((name) => ({ name })), error: null };
	});
	return { db: { storage: { from: () => ({ list }) } } as unknown as Db, list };
}

describe('findEnhanced', () => {
	it('returns the original paths that have an enhanced copy', async () => {
		const { db } = fakeDb({ 'o/p': ['a.jpg', 'a_thumb.jpg', 'a_enh.jpg', 'b.webp', 'b_thumb.webp'] });
		const found = await findEnhanced(db, ['o/p/a.jpg', 'o/p/b.webp']);
		expect([...found]).toEqual(['o/p/a.jpg']);
	});

	it('lists each folder once, with a limit above the default of 100', async () => {
		const { db, list } = fakeDb({ 'o/p': [], 'o/q': ['c_enh.jpg'] });
		const found = await findEnhanced(db, ['o/p/a.jpg', 'o/p/b.jpg', 'o/q/c.jpg']);
		expect(list).toHaveBeenCalledTimes(2);
		expect(list.mock.calls[0][1]).toMatchObject({ limit: 1000 });
		expect([...found]).toEqual(['o/q/c.jpg']);
	});

	it('does not list anything when there are no photos', async () => {
		const { db, list } = fakeDb({});
		expect((await findEnhanced(db, [])).size).toBe(0);
		expect(list).not.toHaveBeenCalled();
	});

	it('falls back to "none enhanced" when the listing fails, so the page still loads', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { db } = fakeDb({ 'o/p': new Error('boom') });
		expect((await findEnhanced(db, ['o/p/a.jpg'])).size).toBe(0);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});
