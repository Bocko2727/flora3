import { describe, expect, it } from 'vitest';
import { MAX_FILES_PER_BATCH } from '$lib/photos/process';
import { buildDrafts, fileKey, requestCount } from '$lib/upload/drafts';

const file = (name: string, size = 10, lastModified = 1) =>
	new File([new Uint8Array(size)], name, { type: 'image/jpeg', lastModified });

let n = 0;
const ids = () => `id-${++n}`;

describe('buildDrafts', () => {
	it('"one" mode puts every file into a single draft', () => {
		const out = buildDrafts([file('a.jpg'), file('b.jpg'), file('c.jpg')], 'one', ids);
		expect(out.drafts).toHaveLength(1);
		expect(out.drafts[0].files.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
	});

	it('"each" mode makes one draft per file', () => {
		const out = buildDrafts([file('a.jpg'), file('b.jpg')], 'each', ids);
		expect(out.drafts.map((d) => d.files.map((f) => f.name))).toEqual([['a.jpg'], ['b.jpg']]);
	});

	it('gives every draft its own id', () => {
		const out = buildDrafts([file('a.jpg'), file('b.jpg')], 'each', ids);
		expect(new Set(out.drafts.map((d) => d.id)).size).toBe(2);
	});

	it('returns no drafts for an empty selection', () => {
		expect(buildDrafts([], 'one', ids)).toEqual({ drafts: [], tooMany: false, duplicates: 0 });
		expect(buildDrafts([], 'each', ids).drafts).toEqual([]);
	});

	it('drops exact duplicates (same name, size and date) and counts them', () => {
		const out = buildDrafts([file('a.jpg'), file('a.jpg'), file('a.jpg', 11)], 'each', ids);
		expect(out.drafts).toHaveLength(2);
		expect(out.duplicates).toBe(1);
	});

	it(`keeps at most ${MAX_FILES_PER_BATCH} files and reports the overflow`, () => {
		const many = Array.from({ length: MAX_FILES_PER_BATCH + 3 }, (_, i) => file(`p${i}.jpg`));
		const each = buildDrafts(many, 'each', ids);
		expect(each.drafts).toHaveLength(MAX_FILES_PER_BATCH);
		expect(each.tooMany).toBe(true);
		const one = buildDrafts(many, 'one', ids);
		expect(one.drafts[0].files).toHaveLength(MAX_FILES_PER_BATCH);
		expect(one.tooMany).toBe(true);
	});

	it('does not report overflow at exactly the limit', () => {
		const exact = Array.from({ length: MAX_FILES_PER_BATCH }, (_, i) => file(`p${i}.jpg`));
		expect(buildDrafts(exact, 'each', ids).tooMany).toBe(false);
	});
});

describe('requestCount', () => {
	it('is one Pl@ntNet request per draft, never per file', () => {
		const files = [file('a.jpg'), file('b.jpg'), file('c.jpg')];
		expect(requestCount(buildDrafts(files, 'one', ids).drafts)).toBe(1);
		expect(requestCount(buildDrafts(files, 'each', ids).drafts)).toBe(3);
		expect(requestCount([])).toBe(0);
	});
});

describe('fileKey', () => {
	it('differs when name, size or date differ', () => {
		const base = fileKey(file('a.jpg', 10, 1));
		expect(fileKey(file('b.jpg', 10, 1))).not.toBe(base);
		expect(fileKey(file('a.jpg', 11, 1))).not.toBe(base);
		expect(fileKey(file('a.jpg', 10, 2))).not.toBe(base);
	});
});
