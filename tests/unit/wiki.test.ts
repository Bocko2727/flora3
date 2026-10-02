import { describe, expect, it } from 'vitest';
import { WIKI_EXTRACT_MAX, findWiki } from '$lib/server/external/wiki';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const search = { query: { search: [{ title: 'Q158244' }] } };
const entity = {
	entities: {
		Q158244: {
			labels: { bg: { language: 'bg', value: 'Паричка' } },
			sitelinks: { bgwiki: { site: 'bgwiki', title: 'Паричка' } }
		}
	}
};
const summary = {
	extract: 'Паричката е многогодишно тревисто растение от семейство Сложноцветни.',
	content_urls: { desktop: { page: 'https://bg.wikipedia.org/wiki/%D0%9F%D0%B0%D1%80%D0%B8%D1%87%D0%BA%D0%B0' } }
};

function stub(routes: { search?: Response; entity?: Response; summary?: Response }) {
	const calls: string[] = [];
	const fetchFn = (async (input: RequestInfo | URL) => {
		const url = String(input);
		calls.push(url);
		if (url.includes('list=search')) return routes.search ?? json(search);
		if (url.includes('wbgetentities')) return routes.entity ?? json(entity);
		if (url.includes('bg.wikipedia.org/api/rest_v1/page/summary/')) return routes.summary ?? json(summary);
		throw new Error(`unexpected ${url}`);
	}) as typeof fetch;
	return { fetchFn, calls };
}

describe('findWiki', () => {
	it('returns the Bulgarian name, article and extract', async () => {
		const { fetchFn, calls } = stub({});
		expect(await findWiki(3117813, fetchFn)).toEqual({
			name_bg: 'Паричка',
			title: 'Паричка',
			url: summary.content_urls.desktop.page,
			extract: summary.extract
		});
		expect(calls[0]).toContain('haswbstatement%3AP846%3D3117813');
	});

	it('returns null when Wikidata has no item for the GBIF key', async () => {
		const { fetchFn } = stub({ search: json({ query: { search: [] } }) });
		expect(await findWiki(1, fetchFn)).toBeNull();
	});

	it('keeps the Bulgarian label when there is no bgwiki article', async () => {
		const noArticle = { entities: { Q158244: { labels: entity.entities.Q158244.labels, sitelinks: {} } } };
		const { fetchFn, calls } = stub({ entity: json(noArticle) });
		expect(await findWiki(3117813, fetchFn)).toEqual({ name_bg: 'Паричка', title: null, url: null, extract: null });
		expect(calls.some((u) => u.includes('summary'))).toBe(false);
	});

	it('keeps the article link when the summary is missing', async () => {
		const { fetchFn } = stub({ summary: json({}, 404) });
		expect(await findWiki(3117813, fetchFn)).toMatchObject({ name_bg: 'Паричка', title: 'Паричка', extract: null });
	});

	it('ignores a Bulgarian label that is only the Latin name', async () => {
		const latin = { entities: { Q158244: { labels: { bg: { value: 'Cistus creticus' } }, sitelinks: {} } } };
		const { fetchFn } = stub({ entity: json(latin) });
		expect(await findWiki(6438085, fetchFn)).toEqual({ name_bg: null, title: null, url: null, extract: null });
	});

	it('returns null when the network fails', async () => {
		const fetchFn = (async () => {
			throw new Error('offline');
		}) as typeof fetch;
		expect(await findWiki(3117813, fetchFn)).toBeNull();
	});

	it('trims a long extract at a sentence boundary', async () => {
		const sentence = 'Това е изречение с достатъчно дължина за теста. ';
		const long = sentence.repeat(100);
		const { fetchFn } = stub({ summary: json({ ...summary, extract: long }) });
		const result = await findWiki(3117813, fetchFn);
		expect(result!.extract!.length).toBeLessThanOrEqual(WIKI_EXTRACT_MAX);
		expect(result!.extract!.endsWith('.') || result!.extract!.endsWith('…')).toBe(true);
	});
});
