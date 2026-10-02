// Bulgarian name and article for a GBIF taxon: Wikidata (P846 = GBIF taxon ID) → bg.wikipedia summary.
// Never throws: any failure is logged by name only and reported as "no information".

const WIKIDATA = 'https://www.wikidata.org/w/api.php';
const WIKIPEDIA_SUMMARY = 'https://bg.wikipedia.org/api/rest_v1/page/summary/';
const TIMEOUT_MS = 8_000;
const HEADERS = { accept: 'application/json', 'user-agent': 'Flora3/1.0 (personal botanical catalog)' };

export const WIKI_EXTRACT_MAX = 1500;

export type WikiInfo = { name_bg: string | null; extract: string | null; url: string | null; title: string | null };

async function getJson(url: string, fetchFn: typeof fetch): Promise<unknown | null> {
	const response = await fetchFn(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
	if (!response.ok) return null;
	return response.json();
}

const obj = (v: unknown): Record<string, unknown> | null =>
	typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** Cuts at the last full sentence that fits; falls back to a word boundary with an ellipsis. */
export function trimExtract(text: string, max = WIKI_EXTRACT_MAX): string {
	const clean = text.replace(/\s+/g, ' ').trim();
	if (clean.length <= max) return clean;
	const head = clean.slice(0, max);
	const sentenceEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
	if (sentenceEnd > max / 2) return head.slice(0, sentenceEnd + 1);
	const space = head.lastIndexOf(' ', max - 1);
	return `${head.slice(0, space > 0 ? space : max - 1)}…`;
}

export async function findWiki(gbifKey: number, fetchFn: typeof fetch = fetch): Promise<WikiInfo | null> {
	try {
		const searchUrl = `${WIKIDATA}?${new URLSearchParams({
			action: 'query',
			list: 'search',
			srsearch: `haswbstatement:P846=${gbifKey}`,
			srlimit: '1',
			format: 'json'
		})}`;
		const hits = obj(obj(await getJson(searchUrl, fetchFn))?.query)?.search;
		const qid = Array.isArray(hits) ? str(obj(hits[0])?.title) : null;
		if (!qid || !/^Q\d+$/.test(qid)) return null;

		const entityUrl = `${WIKIDATA}?${new URLSearchParams({
			action: 'wbgetentities',
			ids: qid,
			props: 'labels|sitelinks',
			languages: 'bg',
			sitefilter: 'bgwiki',
			format: 'json'
		})}`;
		const entity = obj(obj(obj(await getJson(entityUrl, fetchFn))?.entities)?.[qid]);
		const name_bg = str(obj(obj(entity?.labels)?.bg)?.value);
		const title = str(obj(obj(entity?.sitelinks)?.bgwiki)?.title);
		if (!title) return { name_bg, extract: null, url: null, title: null };

		const summary = obj(await getJson(`${WIKIPEDIA_SUMMARY}${encodeURIComponent(title.replace(/ /g, '_'))}`, fetchFn));
		const extract = str(summary?.extract);
		const url = str(obj(obj(summary?.content_urls)?.desktop)?.page) ?? `https://bg.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
		return { name_bg, title, url, extract: extract ? trimExtract(extract) : null };
	} catch (e) {
		console.error('Wikidata/Wikipedia lookup failed', gbifKey, e instanceof Error ? e.name : 'unknown');
		return null;
	}
}
